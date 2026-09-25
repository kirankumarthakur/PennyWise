import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function LineChartCard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/analytics');
      const result = await response.json();
      
      if (result.success) {
        setData(result.monthlyData);
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
    
    // Listen for expense changes to refresh data
    const handleExpenseChange = () => {
      setTimeout(fetchAnalytics, 500); // Small delay to ensure backend is updated
    };
    
    window.addEventListener('expenseAdded', handleExpenseChange);
    window.addEventListener('expenseDeleted', handleExpenseChange);
    
    return () => {
      window.removeEventListener('expenseAdded', handleExpenseChange);
      window.removeEventListener('expenseDeleted', handleExpenseChange);
    };
  }, []);

  const max = data.length > 0 ? Math.max(...data.map(d => d.amount)) : 0;
  const points = data.length > 0 ? data.map((d, i) => {
    const x = 20 + (i * 80) / (data.length - 1);
    const y = 100 - (d.amount / max) * 80;
    return `${x},${y}`;
  }).join(" ") : "";

  return (
    <motion.div 
      className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-100 dark:border-gray-700 flex flex-col gap-2" 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
    >
      <h2 className="font-semibold mb-2 text-gray-900 dark:text-white text-base">Monthly Expenses</h2>
      
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-32 text-red-500">
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
          <svg width={130} height={120} viewBox="0 0 120 120" className="mx-auto">
            {data.length > 0 ? (
              <>
                <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth={3} strokeLinecap="round" />
                {data.map((d, i) => {
                  const x = 20 + (i * 80) / (data.length - 1);
                  const y = 100 - (d.amount / max) * 80;
                  return <circle key={i} cx={x} cy={y} r={4} fill="#3b82f6" className="dark:stroke-gray-800" strokeWidth={1} />;
                })}
              </>
            ) : (
              <text x="60" y="60" textAnchor="middle" fill="#9ca3af" fontSize="12">No data</text>
            )}
          </svg>
          
          <ul className="mt-2 text-xs space-y-1">
            {data.length === 0 ? (
              <li className="text-gray-400 text-center">No data available.</li>
            ) : (
              data.map((d, i) => (
                <li key={i} className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>{d.month}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">₹{d.amount.toFixed(0)}</span>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </motion.div>
  );
}
