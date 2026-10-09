import React, { useState, useEffect } from "react";
import { Sparkles, Key, CheckCircle2, AlertCircle, RefreshCw, Cpu, Wallet, Eye, EyeOff, Trash2, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { apiFetch } from "../config/api";
import { useAiKey } from "../context/AiKeyContext";

const PUBLIC_MODELS = {
  gemini: [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-3.1-pro",
  ],
  openai: [
    "gpt-6-luna",
    "gpt-6.1-sol",
    "gpt-6-astra",
    "o3-mini",
    "gpt-4o",
  ],
  anthropic: [
    "claude-haiku-5.5",
    "claude-sonnet-5.5",
    "claude-opus-5.5",
    "claude-fable-5.1",
  ],
};

const DEFAULT_MODELS = {
  gemini: "gemini-3.8-flash",
  openai: "gpt-6-luna",
  anthropic: "claude-haiku-5.5",
};

export default function Settings({ onResetDemo }) {
  const { apiKey: inMemoryKey, provider: inMemoryProvider, setApiKey: setContextKey, setProvider: setContextProvider, removeKey: removeContextKey } = useAiKey();

  const [activeTab, setActiveTab] = useState("ai"); // 'ai' | 'preferences'
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingProvider, setTestingProvider] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [providerModels, setProviderModels] = useState(PUBLIC_MODELS);
  const [fetchingModelsProvider, setFetchingModelsProvider] = useState(null);
  const [modelsNotice, setModelsNotice] = useState(null);

  // Form states
  const [activeProvider, setActiveProvider] = useState(inMemoryProvider || "gemini");
  const [apiKeys, setApiKeys] = useState({
    gemini: inMemoryProvider === "gemini" ? inMemoryKey : "",
    openai: inMemoryProvider === "openai" ? inMemoryKey : "",
    anthropic: inMemoryProvider === "anthropic" ? inMemoryKey : "",
  });
  const [models, setModels] = useState(DEFAULT_MODELS);
  const [monthlyBudget, setMonthlyBudget] = useState(15000);
  const [currency, setCurrency] = useState("INR");
  const [showKeys, setShowKeys] = useState({ gemini: false, openai: false, anthropic: false });
  const [resettingDemo, setResettingDemo] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        const s = data.settings;
        setSettings(s);
        setActiveProvider(inMemoryProvider || s.active_provider || "gemini");
        setMonthlyBudget(s.monthly_budget || 15000);
        setCurrency(s.currency || "INR");

        setProviderModels({
          gemini: s.providers?.gemini?.available_models || PUBLIC_MODELS.gemini,
          openai: s.providers?.openai?.available_models || PUBLIC_MODELS.openai,
          anthropic: s.providers?.anthropic?.available_models || PUBLIC_MODELS.anthropic,
        });

        setModels({
          gemini: s.providers?.gemini?.model || DEFAULT_MODELS.gemini,
          openai: s.providers?.openai?.model || DEFAULT_MODELS.openai,
          anthropic: s.providers?.anthropic?.model || DEFAULT_MODELS.anthropic,
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

  const handleKeyChange = (provider, value) => {
    setApiKeys((prev) => ({ ...prev, [provider]: value }));
    if (activeProvider === provider) {
      setContextKey(value);
    }
  };

  const handleRemoveKey = (provider) => {
    setApiKeys((prev) => ({ ...prev, [provider]: "" }));
    if (activeProvider === provider) {
      removeContextKey();
    }
    setTestResult(null);
  };

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
      currency: currency,
    };

    // Keep active key in React memory context
    const currentKey = apiKeys[activeProvider];
    if (currentKey) {
      setContextKey(currentKey);
      setContextProvider(activeProvider);
    }

    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        if (data.settings) {
          setSettings(data.settings);
        }
        window.dispatchEvent(new CustomEvent("settingsUpdated"));
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      alert("Failed to save session settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestKey = async (provider) => {
    setTestingProvider(provider);
    setTestResult(null);

    const key = apiKeys[provider];
    const model = models[provider];

    if (!key || !key.trim()) {
      setTestResult({
        provider,
        success: false,
        message: `Please enter an API key for ${provider.toUpperCase()} first.`,
      });
      setTestingProvider(null);
      return;
    }

    try {
      const res = await apiFetch("/api/settings/test-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Key": key.trim(),
          "X-AI-Provider": provider,
          "X-AI-Model": model,
        },
        body: JSON.stringify({
          provider,
          api_key: key.trim(),
          model,
        }),
      });
      const data = await res.json();
      const isOk = Boolean(data.success && data.connected);

      setTestResult({
        provider,
        success: isOk,
        latency_ms: data.latency_ms,
        model: data.model || model,
        message: data.message || data.error || (isOk ? "Connection verified successfully in memory." : "Authentication failed."),
      });

      if (isOk) {
        setActiveProvider(provider);
        setContextKey(key.trim());
        setContextProvider(provider);
        if (data.available_models && data.available_models.length > 0) {
          setProviderModels((prev) => ({
            ...prev,
            [provider]: data.available_models,
          }));
        }
        window.dispatchEvent(new CustomEvent("settingsUpdated"));
      }
    } catch (err) {
      setTestResult({
        provider,
        success: false,
        message: "Failed to connect to backend: " + err.message,
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
      const res = await apiFetch("/api/settings/models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Key": key ? key.trim() : "",
          "X-AI-Provider": provider,
        },
        body: JSON.stringify({
          provider,
          api_key: key ? key.trim() : "",
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
          message: `Retrieved ${data.models.length} live models from ${provider.toUpperCase()}.`,
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

  const triggerResetDemo = async () => {
    if (onResetDemo) {
      onResetDemo();
      return;
    }
    if (!window.confirm("Reset your session to default fictional sample transactions?")) return;
    setResettingDemo(true);
    try {
      const res = await apiFetch("/api/expenses/reset-demo", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(new CustomEvent("expenseAdded"));
        window.dispatchEvent(new CustomEvent("settingsUpdated"));
        alert("Demo session reset to default sample expenses.");
      }
    } catch (err) {
      alert("Failed to reset demo: " + err.message);
    } finally {
      setResettingDemo(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
            Settings
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Configure AI providers, models, budget, and currency
          </p>
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
          <span>AI Settings</span>
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
          <span>Budget & Preferences</span>
        </button>
      </div>

      {activeTab === "ai" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Active AI Engine</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Select your preferred LLM provider
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div
                onClick={() => {
                  setActiveProvider("gemini");
                  if (apiKeys.gemini) setContextKey(apiKeys.gemini);
                  setContextProvider("gemini");
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-center justify-between ${
                  activeProvider === "gemini"
                    ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/40 shadow-sm"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                }`}
              >
                <span className="font-bold text-sm text-gray-900 dark:text-white">Google Gemini</span>
                {activeProvider === "gemini" && <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">Selected</span>}
              </div>

              <div
                onClick={() => {
                  setActiveProvider("openai");
                  if (apiKeys.openai) setContextKey(apiKeys.openai);
                  setContextProvider("openai");
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-center justify-between ${
                  activeProvider === "openai"
                    ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/40 shadow-sm"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                }`}
              >
                <span className="font-bold text-sm text-gray-900 dark:text-white">OpenAI</span>
                {activeProvider === "openai" && <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">Selected</span>}
              </div>

              <div
                onClick={() => {
                  setActiveProvider("anthropic");
                  if (apiKeys.anthropic) setContextKey(apiKeys.anthropic);
                  setContextProvider("anthropic");
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-center justify-between ${
                  activeProvider === "anthropic"
                    ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/40 shadow-sm"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                }`}
              >
                <span className="font-bold text-sm text-gray-900 dark:text-white">Anthropic Claude</span>
                {activeProvider === "anthropic" && <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">Selected</span>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {["gemini", "openai", "anthropic"].map((provider) => {
              const isActive = activeProvider === provider;
              const title = provider === "gemini" ? "Google Gemini" : provider === "openai" ? "OpenAI" : "Anthropic Claude";
              const keyPlaceholder = provider === "gemini" ? "AIzaSy..." : provider === "openai" ? "sk-proj-..." : "sk-ant-...";
              const currentKey = apiKeys[provider];
              const hasCurrentKey = Boolean(currentKey && currentKey.trim().length > 0);
              const modelOptions = providerModels[provider]?.length > 0 ? providerModels[provider] : PUBLIC_MODELS[provider];

              return (
                <div
                  key={provider}
                  className={`bg-white dark:bg-gray-800 rounded-2xl p-5 border transition ${
                    isActive ? "border-blue-300 dark:border-blue-700 shadow-sm" : "border-gray-100 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${isActive ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}>
                        <Key size={14} />
                      </div>
                      <h4 className="font-bold text-xs text-gray-900 dark:text-white">{title} Configuration</h4>
                      {hasCurrentKey && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 size={11} /> Configured
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {hasCurrentKey && (
                        <button
                          type="button"
                          onClick={() => handleRemoveKey(provider)}
                          className="flex items-center gap-1 px-2.5 py-1 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-[11px] font-semibold rounded-lg transition"
                          title="Clear API key"
                        >
                          <Trash2 size={12} />
                          <span>Remove Key</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTestKey(provider)}
                        disabled={testingProvider === provider || !hasCurrentKey}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-[11px] font-semibold rounded-lg transition disabled:opacity-40"
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
                          value={currentKey}
                          onChange={(e) => handleKeyChange(provider, e.target.value)}
                          placeholder={keyPlaceholder}
                          className="w-full px-3 py-2 pr-9 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKeys({ ...showKeys, [provider]: !showKeys[provider] })}
                          className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          title={showKeys[provider] ? "Hide API key" : "Show API key"}
                        >
                          {showKeys[provider] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                          Model
                        </label>
                        <button
                          type="button"
                          onClick={() => fetchLiveModels(provider)}
                          disabled={fetchingModelsProvider === provider}
                          className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition disabled:opacity-50"
                          title="Query live models from provider API"
                        >
                          <RefreshCw size={11} className={fetchingModelsProvider === provider ? "animate-spin" : ""} />
                          <span>{fetchingModelsProvider === provider ? "Fetching..." : "Fetch Live Models"}</span>
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
                          placeholder="e.g. gemini-3.8-flash, gpt-6-luna, claude-haiku-5.5"
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
                  Base Display Currency
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

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Reset Demo Data
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Reset expenses and settings back to default sample data
                </p>
              </div>
              <button
                type="button"
                onClick={triggerResetDemo}
                disabled={resettingDemo}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                <RotateCcw size={13} className={resettingDemo ? "animate-spin" : ""} />
                <span>{resettingDemo ? "Resetting..." : "Reset Data"}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
