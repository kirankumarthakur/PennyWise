import React, { useState, useEffect } from "react";
import { X, Plus, Sparkles, Check, AlertCircle, Tag, Upload, Paperclip } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AiSmartFillModal from "./ai/AiSmartFillModal";
import { apiFetch } from "../config/api";

const CATEGORIES = [
  "Food & Dining",
  "Shopping",
  "Transportation",
  "Bills & Utilities",
  "Healthcare",
  "Entertainment",
  "Tools",
  "Business Services",
  "Personal & Family",
  "Miscellaneous",
];

export default function AddExpenseModal({ isOpen, onClose }) {
  const today = new Date().toISOString().split("T")[0];

  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [category, setCategory] = useState("Food & Dining");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [availableTags, setAvailableTags] = useState([]);
  const [receiptFile, setReceiptFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isSmartFillOpen, setIsSmartFillOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      apiFetch("/api/tags")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.tags) {
            setAvailableTags(data.tags);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddTag = (tagToAdd) => {
    const clean = (tagToAdd || tagInput).trim().toLowerCase().replace(/^#/, "");
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput("");
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleApplyFromAI = (parsed) => {
    if (parsed.vendor) setVendor(parsed.vendor);
    if (parsed.amount) setAmount(parsed.amount.toString());
    if (parsed.category) setCategory(parsed.category);
    if (parsed.date) setDate(parsed.date);
    if (parsed.tags && parsed.tags.length > 0) {
      setTags([...new Set([...tags, ...parsed.tags])]);
    }
    if (parsed.notes) setNotes(parsed.notes);
  };

  const handleAutoCategorize = async () => {
    if (!vendor.trim()) {
      setError("Enter a vendor name first to suggest a category and tags");
      return;
    }

    try {
      setSuggesting(true);
      setError(null);
      const res = await apiFetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: vendor.trim(),
          amount: parseFloat(amount) || 0,
          notes: notes.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.suggestion) {
        if (data.suggestion.category) {
          setCategory(data.suggestion.category);
        }
        if (data.suggestion.tags && data.suggestion.tags.length > 0) {
          setTags([...new Set([...tags, ...data.suggestion.tags])]);
        }
      }
    } catch (err) {
      console.error("Auto categorize failed:", err);
    } finally {
      setSuggesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!vendor.trim()) {
      setError("Vendor name is required");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    if (!date) {
      setError("Date is required");
      return;
    }

    try {
      setLoading(true);

      let receiptUrl = "";
      // If a receipt file was optionally attached
      if (receiptFile) {
        const formData = new FormData();
        formData.append(receiptFile.type === "application/pdf" ? "pdf" : "image", receiptFile);
        try {
          const uploadRes = await apiFetch("/api/process-bill", {
            method: "POST",
            body: formData,
          });
          const uploadData = await uploadRes.json();
          if (uploadData.receipt_url) {
            receiptUrl = uploadData.receipt_url;
          }
        } catch (uploadErr) {
          console.warn("Could not save receipt file:", uploadErr);
        }
      }

      const payload = {
        vendor: vendor.trim(),
        amount: parsedAmount,
        currency,
        category,
        date,
        tags,
        items: notes.trim() ? [notes.trim()] : [],
        receipt_url: receiptUrl || null,
      };

      const response = await apiFetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccess(true);
        window.dispatchEvent(new CustomEvent("expenseAdded", { detail: result.expense }));

        setTimeout(() => {
          setSuccess(false);
          onClose();
          // Reset
          setVendor("");
          setAmount("");
          setCategory("Food & Dining");
          setDate(today);
          setNotes("");
          setTags([]);
          setReceiptFile(null);
        }, 700);
      } else {
        setError(result.error || "Failed to add expense");
      }
    } catch (err) {
      console.error("Failed to add expense:", err);
      setError("Failed to connect to backend server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 max-h-[92vh] flex flex-col"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg">
                <Plus size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Expense</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Record a manual or receipt-backed expense</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSmartFillOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/60 transition"
              >
                <Sparkles size={13} className="text-purple-600 dark:text-purple-400" />
                <span>Fill with AI</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 rounded-lg">
                <Check size={16} />
                <span>Expense added successfully!</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Vendor / Merchant <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Starbucks, Amazon, Grocery Store"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Category <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAutoCategorize}
                  disabled={suggesting}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium disabled:opacity-50"
                >
                  <Sparkles size={12} className={suggesting ? "animate-spin" : ""} />
                  {suggesting ? "Predicting..." : "Auto Predict"}
                </button>
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <Tag size={13} className="text-blue-500" />
                <span>Tags (groceries, tech, personal, etc.)</span>
              </label>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-blue-900 dark:hover:text-white ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a tag and press Enter..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag()}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-200 transition"
                >
                  Add
                </button>
              </div>

              {availableTags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] text-gray-400">Popular:</span>
                  {availableTags.slice(0, 5).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleAddTag(t)}
                      className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted"
                    >
                      +{t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g., Team lunch, Client meeting"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                <Paperclip size={13} className="text-gray-500" />
                <span>Attach Receipt Document (Optional)</span>
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || success}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition disabled:opacity-50"
              >
                {loading ? "Saving..." : success ? "Saved!" : "Save Expense"}
              </button>
            </div>
          </form>
        </motion.div>

        <AiSmartFillModal
          isOpen={isSmartFillOpen}
          onClose={() => setIsSmartFillOpen(false)}
          onApplyToForm={handleApplyFromAI}
        />
      </div>
    </AnimatePresence>
  );
}
