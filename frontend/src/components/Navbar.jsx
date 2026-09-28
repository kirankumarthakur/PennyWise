import React, { useState, useEffect } from "react";
import { UserCircle, Plus, Wallet, Sun, Moon, Sparkles, RotateCcw } from "lucide-react";
import { apiFetch } from "../config/api";
import { useAiKey } from "../context/AiKeyContext";

export default function Navbar({ onOpenAddExpense, darkMode, onToggleDarkMode, onNavigateSettings, onResetDemo }) {
  const { hasKey, provider } = useAiKey();
  const [providerInfo, setProviderInfo] = useState({ provider: "gemini", hasKey: false });

  const fetchAIStatus = async () => {
    try {
      const res = await apiFetch("/api/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        const p = data.settings.active_provider;
        setProviderInfo({ provider: p, hasKey });
      }
    } catch (err) {
      // silent fallback
    }
  };

  useEffect(() => {
    fetchAIStatus();
    window.addEventListener("settingsUpdated", fetchAIStatus);
    return () => window.removeEventListener("settingsUpdated", fetchAIStatus);
  }, [hasKey]);

  const activeHasKey = hasKey || providerInfo.hasKey;
  const activeProvider = provider || providerInfo.provider;

  return (
    <nav className="flex items-center justify-between h-16 px-6 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm">
          <Wallet size={20} />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">PennyWise</h1>
          <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Demo
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {onResetDemo && (
          <button
            onClick={onResetDemo}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            title="Reset demo session to initial sample transactions"
          >
            <RotateCcw size={13} />
            <span>Reset Demo</span>
          </button>
        )}

        <button
          onClick={onNavigateSettings}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition border ${
            activeHasKey
              ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/60"
              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60"
          }`}
          title="Click to manage AI Provider & Memory API Keys in Settings"
        >
          <Sparkles size={13} className={activeHasKey ? "text-purple-600 dark:text-purple-400" : "text-amber-500"} />
          <span className="capitalize">{activeProvider} {activeHasKey ? "Active" : "(Key Needed)"}</span>
        </button>

        {onOpenAddExpense && (
          <button
            onClick={onOpenAddExpense}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
          >
            <Plus size={14} />
            <span>Add Expense</span>
          </button>
        )}

        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition"
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle Dark Mode"
        >
          {darkMode ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-gray-600" />}
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
          <button 
            onClick={onNavigateSettings}
            className="rounded-full p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            title="User Profile & Settings"
          >
            <UserCircle size={24} />
          </button>
        </div>
      </div>
    </nav>
  );
}
