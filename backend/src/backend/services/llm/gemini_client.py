"""Google Gemini LLM client using the official google-genai SDK."""

import json
import re
import time
import logging
from typing import Any

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


def clean_json_response(raw: str) -> dict[str, Any]:
    """Clean markdown fences from LLM output and parse valid JSON."""
    cleaned = raw.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if match:
        cleaned = match.group(1).strip()
    return json.loads(cleaned)


class GeminiClient:
    """Official Google Gemini Client using google-genai SDK."""

    def __init__(self, api_key: str, model: str = "gemini-3.8-flash"):
        self.api_key = api_key
        deprecated = ("gemini-2.0-flash", "gemini-2.0-flash-exp", "models/gemini-2.0-flash",
                      "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-pro")
        if not model or model in deprecated:
            model = "gemini-3.8-flash"
        self.model = model
        self.client = genai.Client(api_key=api_key)

    def _create_config(
        self,
        response_mime_type: str | None = None,
        system_instruction: str = "",
        max_output_tokens: int | None = None,
    ) -> types.GenerateContentConfig:
        return types.GenerateContentConfig(
            response_mime_type=response_mime_type,
            system_instruction=system_instruction or None,
            max_output_tokens=max_output_tokens,
        )

    def _generate(self, contents: Any, config: types.GenerateContentConfig | None = None) -> Any:
        candidate_models = [self.model]
        for alt in ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.1-pro"]:
            if alt not in candidate_models:
                candidate_models.append(alt)

        last_error = None
        for candidate in candidate_models:
            if hasattr(self.client, "interactions") and hasattr(self.client.interactions, "create") and isinstance(contents, str):
                try:
                    kwargs: dict[str, Any] = {"model": candidate, "input": contents}
                    if config and getattr(config, "system_instruction", None):
                        kwargs["system_instruction"] = str(config.system_instruction)
                    if config and getattr(config, "response_mime_type", None) == "application/json":
                        kwargs["response_mime_type"] = "application/json"
                    res = self.client.interactions.create(**kwargs)
                    out = getattr(res, "output_text", "")
                    if out:
                        if candidate != self.model:
                            self.model = candidate
                        class SimpleResponse:
                            def __init__(self, text: str):
                                self.text = text
                        return SimpleResponse(out)
                except Exception as e:
                    logger.debug("Interactions API generate error for %s: %s", candidate, e)

            for attempt in range(3):
                try:
                    res = self.client.models.generate_content(
                        model=candidate,
                        contents=contents,
                        config=config,
                    )
                    if candidate != self.model:
                        self.model = candidate
                    return res
                except Exception as e:
                    err_msg = str(e)
                    last_error = e
                    is_transient = any(
                        code in err_msg
                        for code in ("503", "UNAVAILABLE", "high demand", "429", "RESOURCE_EXHAUSTED")
                    )
                    if is_transient:
                        backoff = 0.8 * (2 ** attempt)
                        logger.warning("Gemini model %s transient error: %s. Retrying in %.1fs...", candidate, err_msg[:120], backoff)
                        time.sleep(backoff)
                        continue
                    if any(code in err_msg for code in ("404", "NOT_FOUND", "no longer available")):
                        break
                    raise

        if last_error:
            raise last_error

    def generate_text(self, prompt: str, system_instruction: str = "") -> str:
        config = self._create_config(system_instruction=system_instruction)
        response = self._generate(contents=prompt, config=config)
        return response.text or ""

    def generate_json(self, prompt: str, system_instruction: str = "") -> dict[str, Any]:
        config = self._create_config(
            response_mime_type="application/json",
            system_instruction=system_instruction,
        )
        response = self._generate(contents=prompt, config=config)
        text = response.text or "{}"
        return clean_json_response(text)

    def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        system_instruction: str = "",
    ) -> dict[str, Any]:
        config = self._create_config(
            response_mime_type="application/json",
            system_instruction=system_instruction,
        )
        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        response = self._generate(contents=[image_part, prompt], config=config)
        text = response.text or "{}"
        return clean_json_response(text)

    def chat(
        self,
        history: list[dict[str, str]],
        message: str,
        system_instruction: str = "",
    ) -> str:
        contents = []
        for item in history:
            role = "user" if item.get("role") in ("user", "human") else "model"
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=item.get("content", ""))]))

        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))
        config = self._create_config(system_instruction=system_instruction)
        response = self._generate(contents=contents, config=config)
        return response.text or ""

    def validate_connection(self) -> tuple[bool, str]:
        try:
            models_iter = self.client.models.list()
            for _ in models_iter:
                break
            return True, f"Successfully verified connection with Google Gemini ({self.model})."
        except Exception as e:
            err_msg = str(e)
            logger.warning("Gemini authentication error: %s", err_msg)
            return False, f"Invalid API key: {err_msg}"

    def list_available_models(self) -> list[str]:
        try:
            models_iter = self.client.models.list()
            results = []
            for m in models_iter:
                supported = getattr(m, "supported_actions", None) or []
                name = getattr(m, "name", "")
                if not name:
                    continue
                clean = name.replace("models/", "")
                if "generateContent" in supported or not supported:
                    if "gemini" in clean.lower() and not any(skip in clean.lower() for skip in ("embedding", "aqa", "imagen", "retrieval")):
                        results.append(clean)
            if results:
                return sorted(results, reverse=True)
        except Exception as e:
            logger.warning("Error fetching available Gemini models: %s", e)
        return ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.1-pro"]
