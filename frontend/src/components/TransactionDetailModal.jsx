import React, { useState } from "react";
import { X, Calendar, Tag, Trash2, Receipt, ExternalLink, Building, DollarSign } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function TransactionDetailModal({ expense, isOpen, onClose, onDelete }) {
  const [imageZoom, setImageZoom] = useState(false);

  if (!isOpen || !expense) return null;

  const isPdf = expense.receipt_url?.endsWith(".pdf");
  const receiptSrc = expense.receipt_url
    ? expense.receipt_url.startsWith("http")
      ? expense.receipt_url
      : `http://localhost:5000${expense.receipt_url}`
    : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 max-h-[90vh] flex flex-col"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl">
                <Receipt size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Transaction Details</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">ID #{expense.id} • {expense.createdAt ? new Date(expense.createdAt).toLocaleDateString() : expense.date}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Cards: Vendor, Amount, Category, Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendor / Payee</span>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1 flex items-center gap-2">
                  <Building size={18} className="text-gray-400" />
                  {expense.vendor}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Amount</span>
                <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
                  {expense.currency === "INR" ? "₹" : "$"}{Number(expense.amount).toFixed(2)}
                  <span className="text-xs font-normal text-blue-500 ml-1.5">{expense.currency}</span>
                </p>
              </div>
            </div>

            {/* Category & Date */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 rounded-lg">
                  <Tag size={16} />
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Category</span>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{expense.category}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="p-2 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300 rounded-lg">
                  <Calendar size={16} />
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Transaction Date</span>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{expense.date}</p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Attached Tags
              </span>
              {expense.tags && expense.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {expense.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No tags assigned to this expense</p>
              )}
            </div>

            {/* Line Items / Notes */}
            {expense.items && expense.items.length > 0 && (
              <div>
                <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Notes & Line Items
                </span>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                  <ul className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                    {expense.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-gray-400">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Compressed Receipt Preview */}
            <div>
              <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Document / Receipt Archive
              </span>
              {receiptSrc ? (
                <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {isPdf ? "PDF Document" : "Compressed Image Receipt"}
                    </span>
                    <a
                      href={receiptSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <span>Open Full Size</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  {isPdf ? (
                    <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                      <Receipt size={40} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">PDF Bill Attached</p>
                      <a
                        href={receiptSrc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                      >
                        View PDF Document
                      </a>
                    </div>
                  ) : (
                    <div className="relative group cursor-pointer" onClick={() => setImageZoom(!imageZoom)}>
                      <img
                        src={receiptSrc}
                        alt="Receipt"
                        className={`w-full rounded-lg object-contain bg-white dark:bg-gray-800 transition-all ${
                          imageZoom ? "max-h-[600px]" : "max-h-64"
                        }`}
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition rounded-lg">
                        {imageZoom ? "Click to reduce" : "Click to zoom"}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 text-gray-400">
                  <Receipt size={32} className="mx-auto mb-1.5 opacity-40" />
                  <p className="text-xs">No receipt attached (direct manual entry)</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80">
            {onDelete ? (
              <button
                onClick={() => {
                  onDelete(expense.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
              >
                <Trash2 size={15} />
                <span>Delete Expense</span>
              </button>
            ) : <div />}

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
