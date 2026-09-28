"""OpenAI LLM client using the official openai SDK."""

import base64
import json
import re
import logging
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)


def clean_json_response(raw: str) -> dict[str, Any]:
    """Clean markdown fences from LLM output and parse valid JSON."""
    cleaned = raw.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if match:
        cleaned = match.group(1).strip()
    return json.loads(cleaned)


class OpenAIClient:
    """Official OpenAI Client using openai SDK."""

    def __init__(self, api_key: str, model: str = "gpt-6-luna"):
        self.api_key = api_key
        self.model = model
        self.client = OpenAI(api_key=api_key)

    def generate_text(self, prompt: str, system_instruction: str = "") -> str:
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
        )
        return response.choices[0].message.content or ""

    def generate_json(self, prompt: str, system_instruction: str = "") -> dict[str, Any]:
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt + "\nOutput strictly in valid JSON format."})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        text = response.choices[0].message.content or "{}"
        return clean_json_response(text)

    def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        system_instruction: str = "",
    ) -> dict[str, Any]:
        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64_image}"

        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})

        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": prompt + "\nOutput strictly in valid JSON format."},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        })

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        text = response.choices[0].message.content or "{}"
        return clean_json_response(text)

    def chat(
        self,
        history: list[dict[str, str]],
        message: str,
        system_instruction: str = "",
    ) -> str:
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})

        for item in history:
            role = item.get("role", "user")
            if role in ("model", "assistant"):
                role = "assistant"
            else:
                role = "user"
            messages.append({"role": role, "content": item.get("content", "")})

        messages.append({"role": "user", "content": message})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
        )
        return response.choices[0].message.content or ""

    def validate_connection(self) -> tuple[bool, str]:
        try:
            self.client.models.list()
            return True, "Successfully verified connection with OpenAI."
        except Exception as e:
            logger.warning("OpenAI validation error: %s", e)
            return False, str(e)

    def list_available_models(self) -> list[str]:
        try:
            model_list = self.client.models.list()
            sorted_models = sorted(model_list, key=lambda m: getattr(m, "created", 0), reverse=True)
            results = []
            for m in sorted_models:
                mid = getattr(m, "id", "")
                if mid and (mid.startswith("gpt-") or mid.startswith("o1") or mid.startswith("o3") or mid.startswith("chatgpt-")):
                    if not any(skip in mid for skip in ("realtime", "audio", "transcription", "tts", "embedding", "dall-e", "whisper", "babbage", "davinci", "moderation", "instruct")):
                        results.append(mid)
            if results:
                return results
        except Exception as e:
            logger.warning("Error fetching available OpenAI models: %s", e)
        return ["gpt-6-luna", "gpt-6.1-sol", "gpt-6-astra", "o3-mini", "gpt-4o"]
