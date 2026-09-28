"""Factory for resolving and instantiating configured LLM clients."""

import logging
from typing import Optional

from backend.services.llm.base import LLMClient
from backend.services.llm.gemini_client import GeminiClient
from backend.services.llm.openai_client import OpenAIClient
from backend.services.llm.anthropic_client import AnthropicClient
from backend.services.settings_service import SettingsService

logger = logging.getLogger(__name__)


class LLMClientFactory:
    """Factory to create appropriate LLMClient based on active provider and credentials."""

    @staticmethod
    def create_client(
        provider: str,
        api_key: str,
        model: Optional[str] = None,
    ) -> Optional[LLMClient]:
        """Instantiate an LLMClient for a specific provider and key."""
        if not api_key or not api_key.strip():
            return None

        provider = provider.lower().strip()
        try:
            if provider == "gemini":
                model_name = model or "gemini-3.8-flash"
                return GeminiClient(api_key=api_key, model=model_name)
            elif provider == "openai":
                model_name = model or "gpt-6-luna"
                return OpenAIClient(api_key=api_key, model=model_name)
            elif provider == "anthropic":
                model_name = model or "claude-sonnet-5"
                return AnthropicClient(api_key=api_key, model=model_name)
            else:
                logger.warning("Unsupported LLM provider requested: %s", provider)
                return None
        except Exception as e:
            logger.error("Failed to initialize LLMClient for %s: %s", provider, e)
            return None

    @classmethod
    def get_active_client(cls, settings_service: SettingsService) -> Optional[LLMClient]:
        """Get the currently configured active LLM client from settings."""
        config = settings_service.get_active_provider_config()
        return cls.create_client(
            provider=config["provider"],
            api_key=config["api_key"],
            model=config.get("model"),
        )
