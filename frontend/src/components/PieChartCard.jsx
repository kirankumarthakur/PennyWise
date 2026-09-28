import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../config/api";

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6',
  '#6366f1', '#f97316'
];

function getPieSegments(data) {
  if (!data || data.length === 0) return [];
  
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return [];
  
  let startAngle = 0;
  return data.map((d, index) => {
    const angle = (d.value / total) * 360;
    const segment = {
      ...d,
      startAngle,
      endAngle: startAngle + angle,
      color: COLORS[index % COLORS.length]
    };
    startAngle += angle;
    return segment;
  });
}

export default function PieChartCard() {
  const [categoryData, setCategoryData] = useState([]);
  const [tagData, setTagData] = useState([]);
  const [viewMode, setViewMode] = useState("category"); // 'category' | 'tag'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/api/analytics');
      const result = await response.json();
      
      if (result.success) {
        setCategoryData(result.categoryData || []);
        setTagData(result.tagData || []);
      } else {
        setError('Failed to fetch analytics data');
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    
    const handleExpenseChange = () => {
      setTimeout(fetchAnalytics, 400);
    };
    
    window.addEventListener('expenseAdded', handleExpenseChange);
    window.addEventListener('expenseDeleted', handleExpenseChange);
    
    return () => {
      window.removeEventListener('expenseAdded', handleExpenseChange);
      window.removeEventListener('expenseDeleted', handleExpenseChange);
    };
  }, []);

  const activeData = viewMode === "category" ? categoryData : tagData;
  const segments = getPieSegments(activeData);
  const totalValue = activeData.reduce((sum, d) => sum + d.value, 0);

  return (
    <motion.div 
      className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-100 dark:border-gray-700 flex flex-col gap-3" 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white text-base">Expense Breakdown</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {viewMode === "category" ? "Distribution by Category" : "Distribution by Tags"}
          </p>
        </div>

        {/* Toggle between Category and Tags */}
        <div className="inline-flex p-0.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("category")}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              viewMode === "category"
                ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Category
          </button>
          <button
            type="button"
            onClick={() => setViewMode("tag")}
            className={`px-2.5 py-1 rounded-md font-medium transition ${
              viewMode === "tag"
                ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Tags
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center h-44">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-44 text-red-500">
          <div className="text-center">
            <p className="text-xs">{error}</p>
            <button 
              onClick={fetchAnalytics}
              className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="py-2">
            <svg width={130} height={130} viewBox="0 0 120 120" className="mx-auto drop-shadow-sm">
              {segments.length > 0 ? (
                segments.map((seg, i) => {
                  const largeArc = seg.endAngle - seg.startAngle > 180 ? 1 : 0;
                  const r = 50;
                  const cx = 60, cy = 60;
                  const start = [
                    cx + r * Math.cos((Math.PI * seg.startAngle) / 180),
                    cy + r * Math.sin((Math.PI * seg.startAngle) / 180),
                  ];
                  const end = [
                    cx + r * Math.cos((Math.PI * seg.endAngle) / 180),
                    cy + r * Math.sin((Math.PI * seg.endAngle) / 180),
                  ];
                  return (
                    <path
                      key={i}
                      d={`M${cx},${cy} L${start[0]},${start[1]} A${r},${r} 0 ${largeArc},1 ${end[0]},${end[1]} Z`}
                      fill={seg.color}
                      opacity={0.9}
                      className="transition-all hover:opacity-100"
                    />
                  );
                })
              ) : (
                <text x="60" y="65" textAnchor="middle" fill="#9ca3af" fontSize="12">No data</text>
              )}
            </svg>
          </div>
          
          <div className="max-h-40 overflow-y-auto pr-1">
            <ul className="text-xs space-y-1.5 divide-y divide-gray-50 dark:divide-gray-700/50">
              {activeData.length === 0 ? (
                <li className="text-gray-400 text-center py-3">
                  {viewMode === "tag" ? "No tagged expenses yet. Tag transactions to visualize." : "No expense data available."}
                </li>
              ) : (
                activeData.map((d, i) => {
                  const percentage = totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(1) : 0;
                  return (
                    <li key={i} className="pt-1.5 flex items-center justify-between text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-2 truncate">
                        <span 
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        <span className="truncate font-medium">{viewMode === "tag" ? `#${d.name}` : d.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-gray-900 dark:text-white">₹{d.value.toFixed(0)}</span>
                        <span className="text-[10px] text-gray-400">({percentage}%)</span>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}
    </motion.div>
  );
}
