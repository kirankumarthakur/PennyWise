import React, { useState, useEffect } from "react";
import { Info, RotateCcw, GitBranch, ExternalLink } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import UploadCard from "./components/UploadCard";
import AddExpenseCard from "./components/AddExpenseCard";
import AddExpenseModal from "./components/AddExpenseModal";
import Reports from "./components/Reports";
import Settings from "./components/Settings";
import AiChatDrawer from "./components/ai/AiChatDrawer";
import { AiKeyProvider } from "./context/AiKeyContext";
import { apiFetch } from "./config/api";

function AppContent() {
  const [page, setPage] = useState("Dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("pennywise_theme");
    if (saved) return saved === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("pennywise_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("pennywise_theme", "light");
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  const handleResetDemo = async () => {
    if (!window.confirm("Reset your demo session to default sample expenses? All newly added expenses in this session will be refreshed.")) return;
    setResetting(true);
    try {
      const res = await apiFetch("/api/expenses/reset-demo", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(new CustomEvent("expenseAdded"));
        window.dispatchEvent(new CustomEvent("settingsUpdated"));
      }
    } catch (err) {
      console.error("Failed to reset demo:", err);
    } finally {
      setResetting(false);
    }
  };

  let content;
  if (page === "Dashboard") content = <Dashboard onNavigateAddExpense={() => setPage("Add Expense")} />;
  else if (page === "Add Expense") content = <AddExpenseCard onNavigateDashboard={() => setPage("Dashboard")} />;
  else if (page === "Upload Receipt") content = <UploadCard />;
  else if (page === "Reports") content = <Reports />;
  else if (page === "Settings") content = <Settings onResetDemo={handleResetDemo} />;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex-col">
      {!bannerDismissed && (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white text-xs px-4 py-2 flex items-center justify-between gap-3 shadow-sm z-50">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="bg-amber-400 text-gray-900 font-extrabold px-2 py-0.5 rounded text-[10px] tracking-wide uppercase flex-shrink-0">
              Live Demo
            </span>
            <span className="truncate">
              This is a live demo with isolated in-memory session storage. Zero disk persistence. To use the full private application with persistent storage, please clone the <span className="font-semibold underline">main</span> branch.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleResetDemo}
              disabled={resetting}
              className="flex items-center gap-1 bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded text-[11px] font-semibold transition"
              title="Reset sample fictional expenses"
            >
              <RotateCcw size={12} className={resetting ? "animate-spin" : ""} />
              <span>{resetting ? "Resetting..." : "Reset Demo"}</span>
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-white/80 hover:text-white px-1.5 py-0.5 text-xs rounded hover:bg-white/10"
              title="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar setPage={setPage} activePage={page} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Navbar
            onOpenAddExpense={() => setIsModalOpen(true)}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
            onNavigateSettings={() => setPage("Settings")}
            onResetDemo={handleResetDemo}
          />
          <main className="flex-1 p-6 overflow-auto">{content}</main>
        </div>
      </div>

      <AddExpenseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <AiChatDrawer />
    </div>
  );
}

export default function App() {
  return (
    <AiKeyProvider>
      <AppContent />
    </AiKeyProvider>
  );
}
