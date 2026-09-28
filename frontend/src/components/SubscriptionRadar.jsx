import React, { useState, useEffect } from "react";
import { Repeat, Calendar, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { apiFetch } from "../config/api";

export default function SubscriptionRadar() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/ai/insights");
      const data = await res.json();
      if (data.success && data.insights?.subscriptions) {
        setSubscriptions(data.insights.subscriptions);
      }
    } catch (err) {
      console.error("Failed to fetch subscriptions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();

    const handleRefresh = () => {
      setTimeout(fetchSubscriptions, 500);
    };

    window.addEventListener("expenseAdded", handleRefresh);
    window.addEventListener("expenseDeleted", handleRefresh);

    return () => {
      window.removeEventListener("expenseAdded", handleRefresh);
      window.removeEventListener("expenseDeleted", handleRefresh);
    };
  }, []);

  const totalMonthlyCommitment = subscriptions.reduce((sum, s) => sum + s.amount, 0);

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col gap-5"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 rounded-xl">
            <Repeat size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Recurring Subscription Radar</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Auto-detected recurring services and renewal tracking</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Fixed Overhead</span>
          <p className="text-lg font-black text-purple-600 dark:text-purple-400">₹{totalMonthlyCommitment.toFixed(2)}/mo</p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-400 text-xs">
          Scanning your transaction records for recurring subscriptions...
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="p-12 text-center text-gray-400 dark:text-gray-500 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <Repeat size={32} className="mx-auto mb-2 opacity-40" />
          <p className="font-semibold text-xs text-gray-700 dark:text-gray-300">No recurring subscriptions detected yet</p>
          <p className="text-[11px] mt-1">As you log repetitive monthly transactions (Netflix, Spotify, Gym, Utilities), they will appear here automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {subscriptions.map((sub, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700 flex flex-col justify-between gap-3 hover:bg-gray-100/70 dark:hover:bg-gray-700/50 hover:border-purple-300 dark:hover:border-purple-700 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">{sub.vendor}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-semibold mt-1 inline-block">
                    {sub.category}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base font-extrabold text-gray-900 dark:text-white">₹{sub.amount.toFixed(2)}</span>
                  <span className="text-[10px] text-gray-400 block">/month</span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200/50 dark:border-gray-700 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Calendar size={12} className="text-gray-400" />
                  <span>Last billed: {sub.last_billed}</span>
                </div>
                <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-semibold">
                  <ShieldCheck size={13} />
                  <span>Next: {sub.next_expected}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
