import React, { useState, useEffect } from "react";
import { Sparkles, Key, CheckCircle2, AlertCircle, Shield, RefreshCw, Cpu, Wallet, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("ai"); // 'ai' | 'preferences' | 'profile'
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingProvider, setTestingProvider] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [providerModels, setProviderModels] = useState({ gemini: [], openai: [], anthropic: [] });
  const [fetchingModelsProvider, setFetchingModelsProvider] = useState(null);
  const [modelsNotice, setModelsNotice] = useState(null);

  // Form states
  const [activeProvider, setActiveProvider] = useState("gemini");
  const [apiKeys, setApiKeys] = useState({ gemini: "", openai: "", anthropic: "" });
  const [models, setModels] = useState({ gemini: "gemini-3.8-flash", openai: "gpt-4o", anthropic: "claude-3-5-sonnet-latest" });
  const [monthlyBudget, setMonthlyBudget] = useState(15000);
  const [currency, setCurrency] = useState("INR");
  const [showKeys, setShowKeys] = useState({ gemini: false, openai: false, anthropic: false });

  // User Profile State
  const [username, setUsername] = useState("John Doe");
  const [email, setEmail] = useState("john@example.com");

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        const s = data.settings;
        setSettings(s);
        setActiveProvider(s.active_provider || "gemini");
        setMonthlyBudget(s.monthly_budget || 15000);
        setCurrency(s.currency || "INR");

        setProviderModels({
          gemini: s.providers?.gemini?.available_models || [],
          openai: s.providers?.openai?.available_models || [],
          anthropic: s.providers?.anthropic?.available_models || [],
        });

        setModels({
          gemini: s.providers?.gemini?.model || "gemini-3.8-flash",
          openai: s.providers?.openai?.model || "gpt-4o",
          anthropic: s.providers?.anthropic?.model || "claude-3-5-sonnet-latest"
        });

        setApiKeys({
          gemini: s.providers?.gemini?.masked_key || "",
          openai: s.providers?.openai?.masked_key || "",
          anthropic: s.providers?.anthropic?.masked_key || ""
        });
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setTestResult(null);

    const payload = {
      active_provider: activeProvider,
      gemini_model: models.gemini,
      openai_model: models.openai,
      anthropic_model: models.anthropic,
      monthly_budget: monthlyBudget,
      currency: currency
    };

    // Only send key if user actually typed a new one (not masked)
    if (apiKeys.gemini && !apiKeys.gemini.includes("...")) {
      payload.gemini_api_key = apiKeys.gemini;
    }
    if (apiKeys.openai && !apiKeys.openai.includes("...")) {
      payload.openai_api_key = apiKeys.openai;
    }
    if (apiKeys.anthropic && !apiKeys.anthropic.includes("...")) {
      payload.anthropic_api_key = apiKeys.anthropic;
    }

    try {
      const res = await fetch("http://localhost:5000/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        if (data.settings) {
          const s = data.settings;
          setSettings(s);
          setApiKeys({
            gemini: s.providers?.gemini?.masked_key || "",
            openai: s.providers?.openai?.masked_key || "",
            anthropic: s.providers?.anthropic?.masked_key || ""
          });
        }
        window.dispatchEvent(new CustomEvent("settingsUpdated"));
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestKey = async (provider) => {
    setTestingProvider(provider);
    setTestResult(null);

    const key = apiKeys[provider];
    const model = models[provider];

    try {
      const res = await fetch("http://localhost:5000/api/settings/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          api_key: key && key.includes("...") ? "" : key,
          model
        })
      });
      const data = await res.json();
      setTestResult({
        provider,
        success: Boolean(data.success && data.connected),
        latency_ms: data.latency_ms,
        model: data.model || model,
        message: data.message || data.error || (data.connected ? "Connection verified and saved." : "Authentication failed.")
      });

      if (data.available_models && data.available_models.length > 0) {
        setProviderModels((prev) => ({
          ...prev,
          [provider]: data.available_models,
        }));
      }

      if (data.model) {
        setModels((prev) => ({
          ...prev,
          [provider]: data.model,
        }));
      }

      if (data.connected) {
        setActiveProvider(provider);
        if (data.settings) {
          setSettings(data.settings);
        }
        if (data.masked_key) {
          setApiKeys((prev) => ({
            ...prev,
            [provider]: data.masked_key,
          }));
        }
        window.dispatchEvent(new CustomEvent("settingsUpdated"));
      }
    } catch (err) {
      setTestResult({
        provider,
        success: false,
        message: "Failed to connect to backend service. Please check if the server is running."
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const fetchLiveModels = async (provider) => {
    setFetchingModelsProvider(provider);
    setModelsNotice(null);

    const key = apiKeys[provider];
    try {
      const res = await fetch("http://localhost:5000/api/settings/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          api_key: key && key.includes("...") ? "" : key,
        }),
      });
      const data = await res.json();
      if (data.success && data.models && data.models.length > 0) {
        setProviderModels((prev) => ({
          ...prev,
          [provider]: data.models,
        }));
        if (!data.models.includes(models[provider])) {
          setModels((prev) => ({
            ...prev,
            [provider]: data.default_model || data.models[0],
          }));
        }
        setModelsNotice({
          provider,
          type: "success",
          message: `Retrieved ${data.models.length} available models from ${provider.toUpperCase()}.`,
        });
        setTimeout(() => setModelsNotice(null), 4000);
      } else {
        setModelsNotice({
          provider,
          type: "error",
          message: data.error || `Could not fetch models for ${provider}.`,
        });
      }
    } catch (err) {
      setModelsNotice({
        provider,
        type: "error",
        message: `Failed to connect to backend: ${err.message}`,
      });
    } finally {
      setFetchingModelsProvider(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Settings & Integrations</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Configure Multi-Provider AI engines, financial preferences, and profile</p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          <span>{saveSuccess ? "Saved Successfully!" : "Save Changes"}</span>
        </button>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === "ai"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Cpu size={15} />
          <span>AI Intelligence & Keys</span>
        </button>
        <button
          onClick={() => setActiveTab("preferences")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
            activeTab === "preferences"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <Wallet size={15} />
          <span>Budget & Currency</span>
        </button>
      </div>

      {activeTab === "ai" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Active AI Engine</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Choose which provider powers receipt scanning, financial insights, and copilot chat</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div
                onClick={() => setActiveProvider("gemini")}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  activeProvider === "gemini"
                    ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/40 shadow-sm"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">Google Gemini</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                      Free Tier Available
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                    Official google-genai SDK. Real-time multimodal vision, high-speed receipt parsing, and insights with Gemini 3.8 Flash, 2.5 Flash, and Pro.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Gemini 3.8 & 2.5 Flash</span>
                  {activeProvider === "gemini" && <span className="text-blue-600 dark:text-blue-400 font-bold">Selected</span>}
                </div>
              </div>

              <div
                onClick={() => setActiveProvider("openai")}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  activeProvider === "openai"
                    ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/40 shadow-sm"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">OpenAI</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300">
                      Official SDK
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                    Official openai SDK. Multimodal analysis, reasoning, and structured receipt data extraction with GPT-4o, GPT-4o-mini, and o1.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
                  <span>GPT-4o & GPT-4o-mini</span>
                  {activeProvider === "openai" && <span className="text-blue-600 dark:text-blue-400 font-bold">Selected</span>}
                </div>
              </div>

              <div
                onClick={() => setActiveProvider("anthropic")}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  activeProvider === "anthropic"
                    ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/40 shadow-sm"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">Anthropic Claude</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                      Official SDK
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                    Official anthropic SDK. Deep financial reasoning, anomaly explanation, and advisory with Claude 3.5 Sonnet and Claude 3.5 Haiku.
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Claude 3.5 Sonnet & Haiku</span>
                  {activeProvider === "anthropic" && <span className="text-blue-600 dark:text-blue-400 font-bold">Selected</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {["gemini", "openai", "anthropic"].map((provider) => {
              const isActive = activeProvider === provider;
              const title = provider === "gemini" ? "Google Gemini" : provider === "openai" ? "OpenAI" : "Anthropic Claude";
              const keyPlaceholder = provider === "gemini" ? "AIzaSy..." : provider === "openai" ? "sk-proj-..." : "sk-ant-...";
              const modelOptions = providerModels[provider]?.length > 0
                ? providerModels[provider]
                : (settings?.providers?.[provider]?.available_models || []);

              return (
                <div
                  key={provider}
                  className={`bg-white dark:bg-gray-800 rounded-2xl p-5 border transition ${
                    isActive
                      ? "border-blue-300 dark:border-blue-700 shadow-sm"
                      : "border-gray-100 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${isActive ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>
                        <Key size={14} />
                      </div>
                      <h4 className="font-bold text-xs text-gray-900 dark:text-white">{title} Configuration</h4>
                      {settings?.providers?.[provider]?.has_key && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 size={11} /> Saved
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestKey(provider)}
                        disabled={testingProvider === provider}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-[11px] font-semibold rounded-lg transition disabled:opacity-50"
                      >
                        {testingProvider === provider ? (
                          <>
                            <RefreshCw size={12} className="animate-spin text-blue-600 dark:text-blue-400" />
                            <span>Testing...</span>
                          </>
                        ) : (
                          <span>Test Connection</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Test Result Message Banner */}
                  {testResult && testResult.provider === provider && (
                    <div
                      className={`p-3.5 rounded-xl mb-3 text-xs border transition ${
                        testResult.success
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
                          : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {testResult.success ? (
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span>{testResult.success ? "Connection Verified & Active" : "Connection Failed"}</span>
                            {testResult.latency_ms != null && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 font-mono">
                                {testResult.latency_ms}ms latency
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] leading-relaxed opacity-90">{testResult.message}</p>
                          {testResult.success && testResult.model && (
                            <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">
                              Active model: <code className="font-mono bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded">{testResult.model}</code>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        API Key
                      </label>
                      <div className="relative">
                        <input
                          type={showKeys[provider] ? "text" : "password"}
                          value={apiKeys[provider]}
                          onChange={(e) => setApiKeys({ ...apiKeys, [provider]: e.target.value })}
                          placeholder={keyPlaceholder}
                          className="w-full px-3 py-2 pr-9 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKeys({ ...showKeys, [provider]: !showKeys[provider] })}
                          className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          {showKeys[provider] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                          Model Name ({modelOptions.length} available)
                        </label>
                        <button
                          type="button"
                          onClick={() => fetchLiveModels(provider)}
                          disabled={fetchingModelsProvider === provider}
                          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition disabled:opacity-50"
                          title="Fetch real-time available models from provider API"
                        >
                          <RefreshCw size={11} className={fetchingModelsProvider === provider ? "animate-spin" : ""} />
                          <span>{fetchingModelsProvider === provider ? "Fetching..." : "Fetch Models"}</span>
                        </button>
                      </div>

                      {modelsNotice && modelsNotice.provider === provider && (
                        <div
                          className={`p-2 rounded-lg mb-2 text-[11px] border ${
                            modelsNotice.type === "success"
                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                          }`}
                        >
                          {modelsNotice.message}
                        </div>
                      )}

                      <select
                        value={modelOptions.includes(models[provider]) ? models[provider] : "custom"}
                        onChange={(e) => {
                          if (e.target.value !== "custom") {
                            setModels({ ...models, [provider]: e.target.value });
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {modelOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                        <option value="custom">Custom Model ID...</option>
                      </select>
                      {(!modelOptions.includes(models[provider]) || models[provider] === "custom") && (
                        <input
                          type="text"
                          value={models[provider] === "custom" ? "" : models[provider]}
                          onChange={(e) => setModels({ ...models, [provider]: e.target.value })}
                          placeholder="e.g. gemini-2.5-flash, gpt-4o, claude-3-5-sonnet-latest"
                          className="mt-2 w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {activeTab === "preferences" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Budget & Currency Preferences</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Monthly Spending Budget
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                    min="1000"
                    step="500"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Used to calculate spending velocity and budget pacing gauges.</p>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Base Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="INR">INR (₹) - Indian Rupee</option>
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
