import React from "react";
import { Home, PlusCircle, Upload, BarChart2, Settings } from "lucide-react";

const menu = [
  { name: "Dashboard", icon: <Home size={19} /> },
  { name: "Add Expense", icon: <PlusCircle size={19} /> },
  { name: "Upload Receipt", icon: <Upload size={19} /> },
  { name: "Reports", icon: <BarChart2 size={19} /> },
  { name: "Settings", icon: <Settings size={19} /> },
];

export default function Sidebar({ setPage, activePage }) {
  return (
    <aside className="w-64 bg-white dark:bg-gray-800 shadow-sm h-full flex flex-col py-6 border-r border-gray-100 dark:border-gray-700 transition-colors">
      <div className="px-6 mb-8">
        <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">PennyWise</span>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Finance & Receipt Tracker</p>
      </div>
      <nav className="flex-1 px-3">
        <ul className="space-y-1.5">
          {menu.map((item) => {
            const isActive = activePage === item.name;
            return (
              <li key={item.name}>
                <button
                  className={`flex items-center gap-3 px-4 py-2.5 w-full text-left rounded-xl text-sm font-medium transition ${
                    isActive 
                      ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold" 
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white"
                  }`}
                  onClick={() => setPage(item.name)}
                >
                  {item.icon}
                  {item.name}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
