import React from "react";
import { Home, PlusCircle, Upload, BarChart2, Settings, GitBranch, ExternalLink } from "lucide-react";

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
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">PennyWise</span>
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
            Demo
          </span>
        </div>
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

      <div className="px-4 mt-auto">
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-200">
            <GitBranch size={13} className="text-blue-600 dark:text-blue-400" />
            <span>Hosted Demo</span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
            Ephemeral in-memory sandbox. To use the full private application with disk storage, please clone the <span className="font-semibold text-gray-700 dark:text-gray-300">main</span> branch.
          </p>
        </div>
      </div>
    </aside>
  );
}
