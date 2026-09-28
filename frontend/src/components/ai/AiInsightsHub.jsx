import React, { useState, useEffect } from "react";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, RefreshCw, Compass, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

export default function AiInsightsHub({ onSelectCategory }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("velocity"); // 'velocity' | 'anomalies' | 'tips'

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/ai/insights");
      const data = await res.json();
      if (data.success && data.insights) {
        setInsights(data.insights);
      }
    } catch (err) {
      console.error("Failed to fetch AI insights:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();

    const handleRefresh = () => {
      setTimeout(fetchInsights, 500);
    };

    window.addEventListener("expenseAdded", handleRefresh);
    window.addEventListener("expenseDeleted", handleRefresh);

    return () => {
      window.removeEventListener("expenseAdded", handleRefresh);
      window.removeEventListener("expenseDeleted", handleRefresh);
    };
  }, []);

  const velocity = insights?.velocity;
  const anomalies = insights?.anomalies || [];
  const digest = insights?.digest;
  const tips = insights?.tips || [];

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col gap-4"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-amber-500 to-indigo-600 text-white rounded-xl shadow-sm">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>Financial Intelligence</span>
              {insights?.active_provider && (
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded">
                  {insights.active_provider}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Proactive spending analytics & advice</p>
          </div>
        </div>

        <button
          onClick={fetchInsights}
          className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          title="Refresh Insights"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex p-0.5 bg-gray-100 dark:bg-gray-700/60 rounded-xl text-xs font-semibold">
        <button
          onClick={() => setActiveTab("velocity")}
          className={`flex-1 py-1.5 rounded-lg transition ${
            activeTab === "velocity"
              ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          Pace & Digest
        </button>
        <button
          onClick={() => setActiveTab("anomalies")}
          className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
            activeTab === "anomalies"
              ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          <span>Surges</span>
          {anomalies.length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("tips")}
          className={`flex-1 py-1.5 rounded-lg transition ${
            activeTab === "tips"
              ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          Savings Tips
        </button>
      </div>

      {activeTab === "velocity" && velocity && (
        <div className="space-y-3.5 text-xs">
          {digest && (
            <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-blue-900 dark:text-blue-200">
              <span className="font-bold text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-0.5">
                Daily Briefing
              </span>
              <p className="leading-relaxed">{digest.summary}</p>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Compass size={14} className="text-blue-600" />
                Spending Burn Rate
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  velocity.status === "safe"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : velocity.status === "on_track"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                }`}
              >
                {velocity.status === "safe" ? "Comfortable Pace" : velocity.status === "on_track" ? "On Track" : "Over-Pacing"}
              </span>
            </div>

            <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  velocity.pacing_percentage <= 90
                    ? "bg-emerald-500"
                    : velocity.pacing_percentage <= 105
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${Math.min(velocity.pacing_percentage, 100)}%` }}
              />
            </div>

            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug">
              {velocity.message}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 dark:border-gray-700 text-[11px]">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Current Burn:</span>
                <p className="font-bold text-gray-900 dark:text-white">₹{velocity.daily_burn_rate.toFixed(0)}/day</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Safe Target:</span>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">₹{velocity.safe_daily_allowance.toFixed(0)}/day</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "anomalies" && (
        <div className="space-y-2 text-xs">
          {anomalies.length === 0 ? (
            <div className="p-6 text-center text-gray-400 dark:text-gray-500">
              <Compass size={24} className="mx-auto mb-1 opacity-50 text-emerald-500" />
              <p className="font-medium text-xs text-gray-600 dark:text-gray-300">No anomalies detected</p>
              <p className="text-[10px] mt-0.5">Your recent transactions are within normal spending ranges.</p>
            </div>
          ) : (
            anomalies.map((ano, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold">
                    <AlertTriangle size={13} className="text-amber-600" />
                    <span>{ano.title}</span>
                  </div>
                  <span className="font-black text-amber-900 dark:text-amber-200">
                    ₹{ano.amount.toFixed(0)}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                  {ano.description}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "tips" && (
        <div className="space-y-2.5 text-xs">
          {tips.map((tip, i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700 flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white">
                  <Lightbulb size={13} className="text-amber-500" />
                  <span>{tip.title}</span>
                </div>
                {tip.potential_savings && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                    Save {tip.potential_savings}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                {tip.advice}
              </p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
