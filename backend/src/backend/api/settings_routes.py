"""Settings API routes for managing AI provider keys and user preferences."""

import logging
from flask import Blueprint, jsonify, request, current_app

from backend.services.llm.factory import LLMClientFactory

logger = logging.getLogger(__name__)

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")


@settings_bp.route("", methods=["GET"])
def get_settings():
    """Retrieve public application settings with masked keys."""
    settings_service = current_app.extensions["settings_service"]
    return jsonify({"success": True, "settings": settings_service.get_public_settings()})


@settings_bp.route("", methods=["POST"])
def update_settings():
    """Update active provider, API keys, models, and budget preferences."""
    settings_service = current_app.extensions["settings_service"]
    payload = request.get_json() or {}
    updated = settings_service.update_settings(payload)
    return jsonify({"success": True, "settings": updated})


@settings_bp.route("/test-key", methods=["POST"])
def test_key():
    """Test and validate an API key against the specified provider."""
    import time

    payload = request.get_json() or {}
    provider = payload.get("provider", "gemini").lower()
    api_key = payload.get("api_key", "").strip()
    model = payload.get("model")

    settings_service = current_app.extensions["settings_service"]
    if not api_key or api_key.startswith("...") or "..." in api_key:
        api_key = settings_service.get_api_key(provider)

    if not api_key:
        return jsonify({
            "success": False,
            "connected": False,
            "error": f"No API key provided for {provider}. Please enter a valid API key.",
        }), 400

    client = LLMClientFactory.create_client(provider=provider, api_key=api_key, model=model)
    if not client:
        return jsonify({
            "success": False,
            "connected": False,
            "error": f"Failed to initialize client for provider: {provider}",
        }), 400

    start_time = time.perf_counter()
    is_valid, detail = client.validate_connection()
    latency_ms = round((time.perf_counter() - start_time) * 1000)

    active_model = getattr(client, "model", model)

    if is_valid:
        if api_key and "..." not in api_key:
            settings_service.update_settings({
                "active_provider": provider,
                f"{provider}_api_key": api_key,
                f"{provider}_model": active_model,
            })
        available_models = client.list_available_models()
        return jsonify({
            "success": True,
            "connected": True,
            "latency_ms": latency_ms,
            "provider": provider,
            "model": active_model,
            "available_models": available_models,
            "masked_key": settings_service._mask_key(api_key),
            "settings": settings_service.get_public_settings(),
            "message": f"Successfully connected to {provider.title()} ({active_model}) in {latency_ms}ms.",
        })
    else:
        return jsonify({
            "success": False,
            "connected": False,
            "latency_ms": latency_ms,
            "provider": provider,
            "model": active_model,
            "error": detail or f"Failed to authenticate with {provider.title()}. Please verify your API key and model selection.",
        }), 400


@settings_bp.route("/models", methods=["POST", "GET"])
def fetch_provider_models():
    """Fetch live available models from provider API using provided or saved credentials."""
    if request.method == "POST":
        payload = request.get_json() or {}
        provider = payload.get("provider", "gemini").lower()
        api_key = payload.get("api_key", "").strip()
    else:
        provider = request.args.get("provider", "gemini").lower()
        api_key = request.args.get("api_key", "").strip()

    settings_service = current_app.extensions["settings_service"]
    if not api_key or api_key.startswith("...") or "..." in api_key:
        api_key = settings_service.get_api_key(provider)

    baseline_models = settings_service.get_available_models(provider)

    if not api_key:
        return jsonify({
            "success": False,
            "error": f"Please enter an API key for {provider.title()} to query live available models.",
            "models": baseline_models,
        }), 400

    client = LLMClientFactory.create_client(provider=provider, api_key=api_key)
    if not client:
        return jsonify({
            "success": False,
            "error": f"Unsupported provider: {provider}",
            "models": baseline_models,
        }), 400

    try:
        live_models = client.list_available_models()
        default_model = live_models[0] if live_models else (baseline_models[0] if baseline_models else "")
        return jsonify({
            "success": True,
            "provider": provider,
            "models": live_models,
            "default_model": default_model,
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Failed to fetch models from {provider.title()}: {str(e)}",
            "models": baseline_models,
        }), 500
