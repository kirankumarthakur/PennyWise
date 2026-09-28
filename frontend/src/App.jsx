import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import UploadCard from "./components/UploadCard";
import AddExpenseCard from "./components/AddExpenseCard";
import AddExpenseModal from "./components/AddExpenseModal";
import Reports from "./components/Reports";
import Settings from "./components/Settings";
import AiChatDrawer from "./components/ai/AiChatDrawer";

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  let content;
  if (page === "Dashboard") content = <Dashboard onNavigateAddExpense={() => setPage("Add Expense")} />;
  else if (page === "Add Expense") content = <AddExpenseCard onNavigateDashboard={() => setPage("Dashboard")} />;
  else if (page === "Upload Receipt") content = <UploadCard />;
  else if (page === "Reports") content = <Reports />;
  else if (page === "Settings") content = <Settings />;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Sidebar setPage={setPage} activePage={page} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Navbar 
          onOpenAddExpense={() => setIsModalOpen(true)} 
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onNavigateSettings={() => setPage("Settings")}
        />
        <main className="flex-1 p-6 overflow-auto">
          {content}
        </main>
      </div>

      <AddExpenseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <AiChatDrawer />
    </div>
  );
}
