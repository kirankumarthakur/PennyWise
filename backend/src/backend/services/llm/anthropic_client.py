"""Anthropic Claude LLM client using the official anthropic SDK."""

import base64
import json
import re
import logging
from typing import Any

from anthropic import Anthropic

logger = logging.getLogger(__name__)


def clean_json_response(raw: str) -> dict[str, Any]:
    """Clean markdown fences from LLM output and parse valid JSON."""
    cleaned = raw.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if match:
        cleaned = match.group(1).strip()
    return json.loads(cleaned)


class AnthropicClient:
    """Official Anthropic Claude Client using anthropic SDK."""

    def __init__(self, api_key: str, model: str = "claude-haiku-5.5"):
        self.api_key = api_key
        self.model = model
        self.client = Anthropic(api_key=api_key)

    def generate_text(self, prompt: str, system_instruction: str = "") -> str:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            system=system_instruction or "",
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text if response.content else ""

    def generate_json(self, prompt: str, system_instruction: str = "") -> dict[str, Any]:
        sys = (system_instruction + "\nOutput strictly valid JSON with no conversational text.").strip()
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            system=sys,
            messages=[{"role": "user", "content": prompt + "\nRespond with valid JSON."}],
        )
        text = response.content[0].text if response.content else "{}"
        return clean_json_response(text)

    def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        system_instruction: str = "",
    ) -> dict[str, Any]:
        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        media_type = mime_type if mime_type in ("image/jpeg", "image/png", "image/gif", "image/webp") else "image/jpeg"

        sys = (system_instruction + "\nOutput strictly valid JSON with no conversational text.").strip()
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            system=sys,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": b64_image,
                            },
                        },
                        {"type": "text", "text": prompt + "\nRespond with valid JSON."},
                    ],
                }
            ],
        )
        text = response.content[0].text if response.content else "{}"
        return clean_json_response(text)

    def chat(
        self,
        history: list[dict[str, str]],
        message: str,
        system_instruction: str = "",
    ) -> str:
        messages = []
        for item in history:
            role = item.get("role", "user")
            if role in ("model", "assistant"):
                role = "assistant"
            else:
                role = "user"
            messages.append({"role": role, "content": item.get("content", "")})

        messages.append({"role": "user", "content": message})

        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            system=system_instruction or "",
            messages=messages,
        )
        return response.content[0].text if response.content else ""

    def validate_connection(self) -> tuple[bool, str]:
        try:
            res = self.client.messages.create(
                model=self.model,
                max_tokens=10,
                messages=[{"role": "user", "content": "ping"}],
            )
            if res and res.content:
                return True, "Successfully verified connection with Anthropic Claude."
            return False, "Anthropic returned an empty response."
        except Exception as e:
            logger.warning("Anthropic validation error: %s", e)
            return False, str(e)

    def list_available_models(self) -> list[str]:
        try:
            if hasattr(self.client, "models") and hasattr(self.client.models, "list"):
                model_list = self.client.models.list()
                results = []
                for m in model_list:
                    mid = getattr(m, "id", "")
                    if mid and "claude" in mid.lower():
                        results.append(mid)
                if results:
                    return sorted(results, reverse=True)
        except Exception as e:
            logger.warning("Error fetching available Anthropic models: %s", e)
        return ["claude-haiku-5.5", "claude-sonnet-5.5", "claude-opus-5.5", "claude-fable-5.1"]
