"""Settings management service for PennyWise."""

import os
import logging
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_MODELS = {
    "gemini": [
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.5-flash",
        "gemini-3.1-pro",
    ],
    "openai": [
        "gpt-4o",
        "gpt-4o-mini",
        "o1",
        "o1-mini",
    ],
    "anthropic": [
        "claude-3-5-sonnet-latest",
        "claude-3-5-haiku-latest",
        "claude-3-opus-latest",
    ],
}

DEFAULT_MODEL_FOR_PROVIDER = {
    "gemini": "gemini-3.8-flash",
    "openai": "gpt-4o",
    "anthropic": "claude-3-5-sonnet-latest",
}


class SettingsService:
    """Service for managing AI credentials and application preferences."""

    def __init__(self, repo):
        self.repo = repo

    @staticmethod
    def _mask_key(key: str | None) -> str:
        """Return a masked representation of an API key for safe UI display."""
        if not key or len(key) < 8:
            return ""
        return f"{key[:4]}...{key[-4:]}"

    def get_api_key(self, provider: str) -> str:
        """Retrieve the API key for a provider from DB or environment variable."""
        db_key = self.repo.get_setting(f"{provider}_api_key")
        if db_key and db_key.strip():
            return db_key.strip()

        env_vars = {
            "gemini": "GEMINI_API_KEY",
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
        }
        env_var = env_vars.get(provider)
        if env_var:
            return os.environ.get(env_var, "").strip()
        return ""

    def get_active_provider(self) -> str:
        """Get current active AI provider, defaulting to 'gemini'."""
        return self.repo.get_setting("ai_provider", "gemini")

    def get_active_model(self) -> str:
        """Get selected model for active provider."""
        provider = self.get_active_provider()
        default = DEFAULT_MODEL_FOR_PROVIDER.get(provider, "gemini-3.8-flash")
        model = self.repo.get_setting(f"{provider}_model", default)
        if provider == "gemini" and model in ("gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.0-flash-exp", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-2.5-pro"):
            return "gemini-3.8-flash"
        return model

    def get_available_models(self, provider: str) -> list[str]:
        """Get baseline supported models for a provider."""
        return DEFAULT_MODELS.get(provider.lower(), [])

    def get_active_provider_config(self) -> dict[str, str]:
        """Return unmasked active credentials and configuration for LLM clients."""
        provider = self.get_active_provider()
        api_key = self.get_api_key(provider)
        model = self.get_active_model()
        return {
            "provider": provider,
            "api_key": api_key,
            "model": model,
        }

    def get_public_settings(self) -> dict[str, Any]:
        """Return UI-safe application settings with masked API keys."""
        active_provider = self.get_active_provider()

        gemini_key = self.get_api_key("gemini")
        openai_key = self.get_api_key("openai")
        anthropic_key = self.get_api_key("anthropic")

        monthly_budget = float(self.repo.get_setting("monthly_budget", "15000"))
        currency = self.repo.get_setting("currency", "INR")

        return {
            "active_provider": active_provider,
            "providers": {
                "gemini": {
                    "has_key": bool(gemini_key),
                    "masked_key": self._mask_key(gemini_key),
                    "model": self.repo.get_setting("gemini_model", DEFAULT_MODEL_FOR_PROVIDER["gemini"]),
                    "available_models": DEFAULT_MODELS["gemini"],
                },
                "openai": {
                    "has_key": bool(openai_key),
                    "masked_key": self._mask_key(openai_key),
                    "model": self.repo.get_setting("openai_model", DEFAULT_MODEL_FOR_PROVIDER["openai"]),
                    "available_models": DEFAULT_MODELS["openai"],
                },
                "anthropic": {
                    "has_key": bool(anthropic_key),
                    "masked_key": self._mask_key(anthropic_key),
                    "model": self.repo.get_setting("anthropic_model", DEFAULT_MODEL_FOR_PROVIDER["anthropic"]),
                    "available_models": DEFAULT_MODELS["anthropic"],
                },
            },
            "monthly_budget": monthly_budget,
            "currency": currency,
        }

    def update_settings(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Update provider selections, API keys, models, and budget preferences."""
        if "active_provider" in payload:
            provider = payload["active_provider"].lower()
            if provider in DEFAULT_MODELS:
                self.repo.set_setting("ai_provider", provider)

        # Update API keys if provided (and not masked placeholder)
        for provider in ("gemini", "openai", "anthropic"):
            key_name = f"{provider}_api_key"
            if key_name in payload:
                val = str(payload[key_name]).strip()
                if val and "..." not in val:
                    self.repo.set_setting(key_name, val)
                elif val == "":
                    self.repo.set_setting(key_name, "")

            model_name = f"{provider}_model"
            if model_name in payload and payload[model_name]:
                self.repo.set_setting(model_name, str(payload[model_name]).strip())

        if "monthly_budget" in payload:
            try:
                budget = float(payload["monthly_budget"])
                if budget > 0:
                    self.repo.set_setting("monthly_budget", str(budget))
            except (ValueError, TypeError):
                pass

        if "currency" in payload and payload["currency"]:
            self.repo.set_setting("currency", str(payload["currency"]).strip().upper())

        return self.get_public_settings()
