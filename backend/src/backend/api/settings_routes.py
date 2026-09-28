"""Settings API routes for managing in-memory session preferences and zero-persistence AI testing."""

import time
import logging
from flask import Blueprint, jsonify, request, current_app
from backend.services.llm.factory import LLMClientFactory

logger = logging.getLogger(__name__)

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")

PUBLIC_MODELS = {
    "gemini": [
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.5-flash",
        "gemini-3.1-pro",
    ],
    "openai": [
        "gpt-6-luna",
        "gpt-6.1-sol",
        "gpt-6-astra",
        "o3-mini",
        "gpt-4o",
    ],
    "anthropic": [
        "claude-haiku-5.5",
        "claude-sonnet-5.5",
        "claude-opus-5.5",
        "claude-fable-5.1",
    ],
}

DEFAULT_MODELS = {
    "gemini": "gemini-3.8-flash",
    "openai": "gpt-6-luna",
    "anthropic": "claude-haiku-5.5",
}


@settings_bp.route("", methods=["GET"])
def get_settings():
    session_id = request.headers.get("X-Session-ID", "demo")
    session_store = current_app.extensions["session_store"]
    session = session_store.get_or_create(session_id)
    prefs = session.get("settings", {})

    return jsonify({
        "success": True,
        "settings": {
            "is_demo": True,
            "demo_notice": "PennyWise Live Demo runs with ephemeral in-memory sessions. API keys are kept in your browser memory and never written to server storage.",
            "active_provider": prefs.get("active_provider", "gemini"),
            "providers": {
                "gemini": {
                    "has_key": False,
                    "model": prefs.get("gemini_model", DEFAULT_MODELS["gemini"]),
                    "available_models": PUBLIC_MODELS["gemini"],
                },
                "openai": {
                    "has_key": False,
                    "model": prefs.get("openai_model", DEFAULT_MODELS["openai"]),
                    "available_models": PUBLIC_MODELS["openai"],
                },
                "anthropic": {
                    "has_key": False,
                    "model": prefs.get("anthropic_model", DEFAULT_MODELS["anthropic"]),
                    "available_models": PUBLIC_MODELS["anthropic"],
                },
            },
            "monthly_budget": float(prefs.get("monthly_budget", 15000.0)),
            "currency": prefs.get("currency", "INR"),
        },
    })


@settings_bp.route("", methods=["POST"])
def update_settings():
    session_id = request.headers.get("X-Session-ID", "demo")
    session_store = current_app.extensions["session_store"]
    session = session_store.get_or_create(session_id)
    prefs = session.setdefault("settings", {})

    payload = request.get_json() or {}

    if "active_provider" in payload:
        provider = str(payload["active_provider"]).lower().strip()
        if provider in PUBLIC_MODELS:
            prefs["active_provider"] = provider

    for p in ("gemini", "openai", "anthropic"):
        m_key = f"{p}_model"
        if m_key in payload and payload[m_key]:
            prefs[m_key] = str(payload[m_key]).strip()[:64]

    if "monthly_budget" in payload:
        try:
            b = float(payload["monthly_budget"])
            if 0 < b < 100_000_000:
                prefs["monthly_budget"] = b
        except (ValueError, TypeError):
            pass

    if "currency" in payload and payload["currency"]:
        cur = str(payload["currency"]).strip().upper()[:5]
        if cur.isalpha():
            prefs["currency"] = cur

    return get_settings()


@settings_bp.route("/test-key", methods=["POST"])
def test_key():
    payload = request.get_json() or {}
    api_key = (
        request.headers.get("X-AI-Key")
        or payload.get("api_key", "")
    ).strip()
    provider = (
        request.headers.get("X-AI-Provider")
        or payload.get("provider", "gemini")
    ).lower().strip()
    model = (
        request.headers.get("X-AI-Model")
        or payload.get("model")
    )

    if not api_key:
        return jsonify({
            "success": False,
            "connected": False,
            "error": "No API key provided. Please enter your provider API key.",
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
        available_models = client.list_available_models()
        return jsonify({
            "success": True,
            "connected": True,
            "latency_ms": latency_ms,
            "provider": provider,
            "model": active_model,
            "available_models": available_models,
            "message": f"Successfully verified {provider.title()} ({active_model}) in {latency_ms}ms.",
        })
    else:
        return jsonify({
            "success": False,
            "connected": False,
            "latency_ms": latency_ms,
            "provider": provider,
            "model": active_model,
            "error": detail or f"Authentication failed with {provider.title()}.",
        }), 400


@settings_bp.route("/models", methods=["POST", "GET"])
def fetch_provider_models():
    if request.method == "POST":
        payload = request.get_json() or {}
        api_key = (request.headers.get("X-AI-Key") or payload.get("api_key", "")).strip()
        provider = (request.headers.get("X-AI-Provider") or payload.get("provider", "gemini")).lower().strip()
    else:
        api_key = (request.headers.get("X-AI-Key") or request.args.get("api_key", "")).strip()
        provider = (request.headers.get("X-AI-Provider") or request.args.get("provider", "gemini")).lower().strip()

    baseline_models = PUBLIC_MODELS.get(provider, [])

    if not api_key:
        return jsonify({
            "success": True,
            "provider": provider,
            "models": baseline_models,
            "default_model": DEFAULT_MODELS.get(provider, ""),
        })

    client = LLMClientFactory.create_client(provider=provider, api_key=api_key)
    if not client:
        return jsonify({
            "success": False,
            "error": f"Unsupported provider: {provider}",
            "models": baseline_models,
        }), 400

    try:
        live_models = client.list_available_models()
        default_model = live_models[0] if live_models else DEFAULT_MODELS.get(provider, "")
        return jsonify({
            "success": True,
            "provider": provider,
            "models": live_models,
            "default_model": default_model,
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Could not query live models: {str(e)}",
            "models": baseline_models,
        }), 500
