"""Base interface for LLM client implementations."""

from typing import Protocol, runtime_checkable, Any


@runtime_checkable
class LLMClient(Protocol):
    """Protocol defining the core operations required of any LLM provider."""

    def generate_text(self, prompt: str, system_instruction: str = "") -> str:
        """Generate a natural language text response."""
        ...

    def generate_json(self, prompt: str, system_instruction: str = "") -> dict[str, Any]:
        """Generate and parse a structured JSON object response."""
        ...

    def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        system_instruction: str = "",
    ) -> dict[str, Any]:
        """Analyze a receipt or bill document image and extract structured JSON."""
        ...

    def chat(
        self,
        history: list[dict[str, str]],
        message: str,
        system_instruction: str = "",
    ) -> str:
        """Handle a multi-turn conversation turn with system context."""
        ...

    def validate_connection(self) -> tuple[bool, str]:
        """Check if the provided credentials can successfully communicate with the provider."""
        ...

    def list_available_models(self) -> list[str]:
        """Fetch real-time list of available models from provider API."""
        ...
