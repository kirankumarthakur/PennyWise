import React, { useState, useEffect } from "react";
import { Search, Filter, RefreshCw, Plus, Eye, Receipt, Trash2, Tag, Sparkles, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { formatDateInfo } from '../utils/dateUtils';
import AddExpenseModal from "./AddExpenseModal";
import TransactionDetailModal from "./TransactionDetailModal";
import AiSmartFillModal from "./ai/AiSmartFillModal";
import { apiFetch } from "../config/api";

export default function ExpenseTable() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSmartFillOpen, setIsSmartFillOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [selectedTag, setSelectedTag] = useState("All Tags");
  const [date, setDate] = useState("");

  const fetchExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category && category !== 'All Categories') params.append('category', category);
      if (selectedTag && selectedTag !== 'All Tags') params.append('tag', selectedTag);
      if (date) params.append('start_date', date);
      
      const response = await apiFetch(`/api/expenses?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setExpenses(data.expenses);
      } else {
        setError('Failed to fetch expenses');
      }
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    
    const handleExpenseChange = () => {
      setTimeout(fetchExpenses, 400);
    };
    
    window.addEventListener('expenseAdded', handleExpenseChange);
    window.addEventListener('expenseDeleted', handleExpenseChange);
    
    return () => {
      window.removeEventListener('expenseAdded', handleExpenseChange);
      window.removeEventListener('expenseDeleted', handleExpenseChange);
    };
  }, []);

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      const res = await apiFetch(`/api/expenses/${id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        setExpenses(prev => prev.filter(e => e.id !== id));
        window.dispatchEvent(new CustomEvent('expenseDeleted', { detail: { id } }));
        if (selectedExpense?.id === id) {
          setIsDetailOpen(false);
          setSelectedExpense(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete expense:", err);
    }
  };

  const handleRowClick = (expense) => {
    setSelectedExpense(expense);
    setIsDetailOpen(true);
  };

  // Derive unique tags
  const allTags = Array.from(
    new Set(expenses.flatMap(e => e.tags || []).filter(Boolean))
  );

  // Compute stats for in-line AI badges
  const avgAmount = expenses.length > 0 ? expenses.reduce((s, e) => s + e.amount, 0) / expenses.length : 0;
  const vendorCounts = expenses.reduce((acc, e) => {
    const k = e.vendor?.toLowerCase().trim();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  // Client-side filtering
  const filtered = expenses.filter(e => {
    const matchesSearch = !search || e.vendor?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !category || category === 'All Categories' || e.category === category;
    const matchesDate = !date || e.date === date;
    const matchesTag = !selectedTag || selectedTag === 'All Tags' || (e.tags && e.tags.includes(selectedTag));
    return matchesSearch && matchesCategory && matchesDate && matchesTag;
  });

  const formatCurrency = (amount, currency = 'INR') => {
    if (currency === 'INR') {
      return `₹${Number(amount || 0).toFixed(2)}`;
    }
    return `$${Number(amount || 0).toFixed(2)}`;
  };

  const categories = ['All Categories', ...new Set(expenses.map(e => e.category).filter(Boolean))];

  return (
    <motion.div 
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 flex flex-col" 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Expense History</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Transactions with in-line AI intelligence and smart filters</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSmartFillOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 rounded-xl transition shadow-sm"
          >
            <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
            <span>Fill with AI</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
          >
            <Plus size={14} />
            <span>Add Expense</span>
          </button>

          <button 
            onClick={fetchExpenses}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
        <div className="relative">
          <input 
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5 pl-8 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="Search vendor..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
          <Search className="absolute left-2.5 top-2 text-gray-400" size={14} />
        </div>

        <select 
          className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" 
          value={category} 
          onChange={e => setCategory(e.target.value)}
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select 
          className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" 
          value={selectedTag} 
          onChange={e => setSelectedTag(e.target.value)}
        >
          <option value="All Tags">All Tags</option>
          {allTags.map(tg => (
            <option key={tg} value={tg}>#{tg}</option>
          ))}
        </select>

        <input 
          type="date" 
          className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" 
          value={date} 
          onChange={e => setDate(e.target.value)} 
        />
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700 uppercase tracking-wider font-semibold text-[10px]">
              <th className="py-2.5 px-3 text-left">Vendor & Intelligence</th>
              <th className="py-2.5 px-3 text-left">Amount</th>
              <th className="py-2.5 px-3 text-left">Category</th>
              <th className="py-2.5 px-3 text-left">Tags</th>
              <th className="py-2.5 px-3 text-left">Date</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="animate-spin text-blue-600" size={15} />
                    <span>Loading expenses...</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-red-500">
                  <p>{error}</p>
                  <button 
                    onClick={fetchExpenses}
                    className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400 dark:text-gray-500">
                  {expenses.length === 0 ? 'No expenses recorded yet.' : 'No expenses match your filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((expense) => {
                const isHighAmount = expense.amount > avgAmount * 2.5 && avgAmount > 0;
                const isRecurring = (vendorCounts[expense.vendor?.toLowerCase().trim()] || 0) >= 2;

                return (
                  <tr 
                    key={expense.id} 
                    onClick={() => handleRowClick(expense)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/60 cursor-pointer transition group"
                  >
                    <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold">{expense.vendor}</span>
                        {expense.receipt_url && (
                          <span 
                            title="Receipt Attached" 
                            className="p-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                          >
                            <Receipt size={12} />
                          </span>
                        )}
                        {isHighAmount && (
                          <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded text-[10px] font-medium">
                            High
                          </span>
                        )}
                        {isRecurring && (
                          <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 rounded text-[10px] font-medium">
                            Recurring
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(expense.amount, expense.currency)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-semibold text-[11px]">
                        {expense.category}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {expense.tags && expense.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {expense.tags.map(t => (
                            <span 
                              key={t}
                              className="inline-block px-1.5 py-0.2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-[10px]"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-gray-500 dark:text-gray-400">
                      {(() => {
                        const dateInfo = formatDateInfo(expense.date);
                        return (
                          <span className={dateInfo.isToday ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}>
                            {dateInfo.formatted}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRowClick(expense)}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {filtered.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400 flex justify-between items-center">
          <span>Showing {filtered.length} of {expenses.length} expenses</span>
          {selectedTag !== 'All Tags' && (
            <span className="text-blue-600 dark:text-blue-400 font-semibold">
              Filtered by tag #{selectedTag}
            </span>
          )}
        </div>
      )}

      <AddExpenseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <AiSmartFillModal isOpen={isSmartFillOpen} onClose={() => setIsSmartFillOpen(false)} />
      <TransactionDetailModal
        expense={selectedExpense}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedExpense(null);
        }}
        onDelete={handleDeleteExpense}
      />
    </motion.div>
  );
}
