import React, { useState, useEffect } from "react";
import { 
  Wallet, TrendingDown, TrendingUp, Sparkles, Receipt, 
  ArrowUpRight, Clock, Plus, BarChart3, ListFilter, Repeat
} from "lucide-react";
import { motion } from "framer-motion";

import ExpenseTable from "./ExpenseTable";
import PieChartCard from "./PieChartCard";
import LineChartCard from "./LineChartCard";
import SubscriptionRadar from "./SubscriptionRadar";
import UploadCard from "./UploadCard";
import AiInsightsHub from "./ai/AiInsightsHub";
import AddExpenseModal from "./AddExpenseModal";
import AiSmartFillModal from "./ai/AiSmartFillModal";

export default function Dashboard({ onNavigateAddExpense }) {
  const [activeTab, setActiveTab] = useState("transactions"); // 'transactions' | 'trends' | 'subscriptions'
  const [metrics, setMetrics] = useState({
    totalSpentMonth: 0,
    monthlyBudget: 15000,
    dailyBurnRate: 0,
    safeAllowance: 0,
    activeProvider: "gemini",
    expenseCount: 0,
    topCategory: "None"
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSmartFillOpen, setIsSmartFillOpen] = useState(false);

  const fetchDashboardMetrics = async () => {
    try {
      const [insightsRes, expensesRes, settingsRes] = await Promise.all([
        fetch("http://localhost:5000/api/ai/insights"),
        fetch("http://localhost:5000/api/expenses"),
        fetch("http://localhost:5000/api/settings")
      ]);

      const insightsData = await insightsRes.json();
      const expensesData = await expensesRes.json();
      const settingsData = await settingsRes.json();

      const velocity = insightsData?.insights?.velocity || {};
      const expenses = expensesData?.expenses || [];
      const settings = settingsData?.settings || {};

      // Compute top category
      const catCounts = {};
      expenses.forEach(e => {
        catCounts[e.category] = (catCounts[e.category] || 0) + e.amount;
      });
      const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

      setMetrics({
        totalSpentMonth: velocity.total_spent || 0,
        monthlyBudget: velocity.budget || settings.monthly_budget || 15000,
        dailyBurnRate: velocity.daily_burn_rate || 0,
        safeAllowance: velocity.safe_daily_allowance || 0,
        activeProvider: settings.active_provider || "gemini",
        expenseCount: expenses.length,
        topCategory: topCat
      });
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();

    const handleRefresh = () => {
      setTimeout(fetchDashboardMetrics, 500);
    };

    window.addEventListener("expenseAdded", handleRefresh);
    window.addEventListener("expenseDeleted", handleRefresh);
    window.addEventListener("settingsUpdated", handleRefresh);

    return () => {
      window.removeEventListener("expenseAdded", handleRefresh);
      window.removeEventListener("expenseDeleted", handleRefresh);
      window.removeEventListener("settingsUpdated", handleRefresh);
    };
  }, []);

  const remainingBudget = metrics.monthlyBudget - metrics.totalSpentMonth;
  const budgetUtilization = metrics.monthlyBudget > 0 
    ? Math.min((metrics.totalSpentMonth / metrics.monthlyBudget) * 100, 100) 
    : 0;

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Spent (Month)</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-xl">
              <Wallet size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-gray-900 dark:text-white">
              ₹{metrics.totalSpentMonth.toFixed(2)}
            </span>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Budget: ₹{metrics.monthlyBudget.toFixed(0)} ({budgetUtilization.toFixed(0)}% used)
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Daily Burn Rate</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 rounded-xl">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-gray-900 dark:text-white">
              ₹{metrics.dailyBurnRate.toFixed(0)}<span className="text-xs font-normal text-gray-400">/day</span>
            </span>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              Safe Target: ₹{metrics.safeAllowance.toFixed(0)}/day
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Budget Runway</span>
            <div className={`p-2 rounded-xl ${remainingBudget >= 0 ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600" : "bg-red-50 text-red-600"}`}>
              <TrendingDown size={16} />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-black ${remainingBudget >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>
              ₹{remainingBudget.toFixed(2)}
            </span>
            <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full ${budgetUtilization > 90 ? "bg-red-500" : "bg-emerald-500"}`} 
                style={{ width: `${budgetUtilization}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">AI Intelligence Engine</span>
            <div className="p-2 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-xl shadow-sm">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black text-gray-900 dark:text-white capitalize">
                {metrics.activeProvider}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Top Category: <span className="font-semibold text-gray-700 dark:text-gray-300">{metrics.topCategory}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("transactions")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === "transactions"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <ListFilter size={14} />
                <span>Transactions</span>
              </button>

              <button
                onClick={() => setActiveTab("trends")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === "trends"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <BarChart3 size={14} />
                <span>Spending Trends</span>
              </button>

              <button
                onClick={() => setActiveTab("subscriptions")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === "subscriptions"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Repeat size={14} />
                <span>Subscription Radar</span>
              </button>
            </div>

            <div className="flex items-center gap-2 pr-1">
              <button
                onClick={() => setIsSmartFillOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/60 transition"
              >
                <Sparkles size={12} />
                <span>Smart Fill</span>
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
              >
                <Plus size={12} />
                <span>Add</span>
              </button>
            </div>
          </div>

          {activeTab === "transactions" && <ExpenseTable />}

          {activeTab === "trends" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LineChartCard />
              <PieChartCard />
            </div>
          )}

          {activeTab === "subscriptions" && <SubscriptionRadar />}
        </div>

        <div className="lg:col-span-4 space-y-5">
          <AiInsightsHub />
          <UploadCard />
        </div>
      </div>

      <AddExpenseModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      <AiSmartFillModal isOpen={isSmartFillOpen} onClose={() => setIsSmartFillOpen(false)} />
    </div>
  );
}
