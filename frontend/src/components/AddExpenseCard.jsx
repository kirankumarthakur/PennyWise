import React, { useState, useEffect } from "react";
import { PlusCircle, Sparkles, Check, AlertCircle, ArrowLeft, Tag, Paperclip } from "lucide-react";
import { motion } from "framer-motion";
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

export default function AddExpenseCard({ onNavigateDashboard }) {
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
    apiFetch("/api/tags")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.tags) {
          setAvailableTags(data.tags);
        }
      })
      .catch(() => {});
  }, []);

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
      setError("Please enter a vendor or merchant name first to predict category & tags");
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

        // Reset inputs
        setVendor("");
        setAmount("");
        setCategory("Food & Dining");
        setDate(today);
        setNotes("");
        setTags([]);
        setReceiptFile(null);

        setTimeout(() => setSuccess(false), 3000);
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
    <motion.div
      className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <PlusCircle size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Expense</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Record an expense with tags, notes, or receipt</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSmartFillOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/60 transition shadow-sm"
          >
            <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
            <span>Fill with AI</span>
          </button>
          {onNavigateDashboard && (
            <button
              onClick={onNavigateDashboard}
              className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              <ArrowLeft size={14} />
              <span>Dashboard</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-6 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 mb-6 text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 rounded-lg">
          <Check size={16} />
          <span>Expense successfully added! You can view it in the Dashboard or add another.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Vendor / Payee <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g., Starbucks, Amazon, Supermarket, Landlord"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Category <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleAutoCategorize}
              disabled={suggesting}
              className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium disabled:opacity-50"
            >
              <Sparkles size={13} className={suggesting ? "animate-spin" : ""} />
              {suggesting ? "Predicting..." : "Auto Predict Category"}
            </button>
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
            <Tag size={15} className="text-blue-500" />
            <span>Tags (categorize with multiple labels)</span>
          </label>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-blue-900 dark:hover:text-white"
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
              placeholder="e.g., groceries, personal, project (Press Enter to add)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="button"
              onClick={() => handleAddTag()}
              className="px-4 py-2 text-xs font-semibold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition"
            >
              Add Tag
            </button>
          </div>

          {availableTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-gray-400">Suggestions:</span>
              {availableTags.slice(0, 8).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleAddTag(t)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted"
                >
                  +{t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes / Description (Optional)</label>
          <textarea
            rows={2}
            placeholder="Add any additional details, line items, or context..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
            <Paperclip size={15} className="text-gray-500" />
            <span>Attach Receipt Image or PDF (Optional)</span>
          </label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-gray-500 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 cursor-pointer"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm hover:shadow transition disabled:opacity-50"
          >
            {loading ? "Adding Expense..." : "Add Expense"}
          </button>
        </div>
      </form>

      <AiSmartFillModal
        isOpen={isSmartFillOpen}
        onClose={() => setIsSmartFillOpen(false)}
        onApplyToForm={handleApplyFromAI}
      />
    </motion.div>
  );
}
