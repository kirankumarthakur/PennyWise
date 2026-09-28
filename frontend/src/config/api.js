export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "");

export function getSessionId() {
  if (typeof window === "undefined") return "demo";
  let sid = sessionStorage.getItem("pennywise_demo_session_id");
  if (!sid) {
    sid = "demo_" + Math.random().toString(36).substring(2, 12);
    sessionStorage.setItem("pennywise_demo_session_id", sid);
  }
  return sid;
}

let inMemoryCredentials = {
  apiKey: "",
  provider: "gemini",
  model: "",
};

export function getAiCredentials() {
  return { ...inMemoryCredentials };
}

export function setAiCredentials({ apiKey, provider, model }) {
  if (apiKey !== undefined) inMemoryCredentials.apiKey = (apiKey || "").trim();
  if (provider !== undefined) inMemoryCredentials.provider = (provider || "gemini").toLowerCase().trim();
  if (model !== undefined) inMemoryCredentials.model = (model || "").trim();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aiCredentialsUpdated", { detail: inMemoryCredentials }));
  }
}

export function clearAiCredentials() {
  inMemoryCredentials.apiKey = "";
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aiCredentialsUpdated", { detail: inMemoryCredentials }));
  }
}

export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = new Headers(options.headers || {});

  if (!headers.has("X-Session-ID")) {
    headers.set("X-Session-ID", getSessionId());
  }

  if (inMemoryCredentials.apiKey && !headers.has("X-AI-Key")) {
    headers.set("X-AI-Key", inMemoryCredentials.apiKey);
  }
  if (inMemoryCredentials.provider && !headers.has("X-AI-Provider")) {
    headers.set("X-AI-Provider", inMemoryCredentials.provider);
  }
  if (inMemoryCredentials.model && !headers.has("X-AI-Model")) {
    headers.set("X-AI-Model", inMemoryCredentials.model);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
