import React from "react";
import { 
  Home, PlusCircle, Upload, BarChart2, Settings, 
  ChevronLeft, ChevronRight, Wallet 
} from "lucide-react";

const menu = [
  { name: "Dashboard", icon: <Home size={19} /> },
  { name: "Add Expense", icon: <PlusCircle size={19} /> },
  { name: "Upload Receipt", icon: <Upload size={19} /> },
  { name: "Reports", icon: <BarChart2 size={19} /> },
  { name: "Settings", icon: <Settings size={19} /> },
];

export default function Sidebar({ setPage, activePage, isOpen, setIsOpen }) {
  const handleNavClick = (pageName) => {
    setPage(pageName);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          bg-white dark:bg-gray-800 shadow-sm
          flex flex-col border-r border-gray-100 dark:border-gray-700 transition-all duration-300 ease-in-out
          ${isOpen ? "w-60 translate-x-0" : "-translate-x-full md:translate-x-0 md:w-16"}
        `}
      >
        {/* Header: When open show App branding + Collapse (<); when collapsed show ONLY the Open icon (>) */}
        <div
          className={`flex items-center h-16 border-b border-gray-100 dark:border-gray-700/60 ${
            isOpen ? "px-4 justify-between" : "justify-center"
          }`}
        >
          {isOpen ? (
            <>
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm flex-shrink-0">
                  <Wallet size={18} />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-lg font-black text-blue-600 dark:text-blue-400 tracking-tight truncate">
                    PennyWise
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                    Demo
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                title="Collapse Sidebar"
                aria-label="Collapse Sidebar"
              >
                <ChevronLeft size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition"
              title="Expand Sidebar"
              aria-label="Expand Sidebar"
            >
              <ChevronRight size={19} />
            </button>
          )}
        </div>

        {/* Navigation items: In collapsed mode icons are visible (text hidden); in open mode icon + text */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {menu.map((item) => {
            const isActive = activePage === item.name;
            return (
              <button
                key={item.name}
                onClick={() => handleNavClick(item.name)}
                title={!isOpen ? item.name : undefined}
                className={`
                  flex items-center gap-3 w-full rounded-xl text-sm font-medium transition
                  ${isOpen ? "px-3.5 py-2.5 text-left" : "p-2.5 justify-center"}
                  ${isActive 
                    ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold" 
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white"}
                `}
              >
                <div className="flex-shrink-0">{item.icon}</div>
                {isOpen && <span className="truncate">{item.name}</span>}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
