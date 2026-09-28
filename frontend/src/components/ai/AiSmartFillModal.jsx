import React, { useState } from "react";
import { Sparkles, X, Check, ArrowRight, CornerDownLeft, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SAMPLE_TEXTS = [
  "Paid Rs 450 at Starbucks for Caramel Macchiato on 28 Sep",
  "Swiggy order: ₹890 debited from A/C XX4921 for dinner on 27 Sep",
  "Purchased mechanical keyboard on Amazon for Rs 3499 on 25 Sep"
];

export default function AiSmartFillModal({ isOpen, onClose, onApplyToForm }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleParse = async (inputText = null) => {
    const raw = (inputText || text).trim();
    if (!raw) return;

    setLoading(true);
    setError("");
    setParsed(null);

    try {
      const res = await fetch("http://localhost:5000/api/ai/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: raw })
      });
      const data = await res.json();
      if (data.success && data.expense) {
        setParsed(data.expense);
      } else {
        setError(data.error || "Failed to parse text. Please try again.");
      }
    } catch (err) {
      setError("Cannot reach backend server.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDirectly = async () => {
    if (!parsed) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        window.dispatchEvent(new CustomEvent("expenseAdded", { detail: data.expense }));
        setTimeout(() => {
          setSaved(false);
          setParsed(null);
          setText("");
          onClose();
        }, 1200);
      } else {
        setError(data.error || "Failed to save expense.");
      }
    } catch (err) {
      setError("Network error saving expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleApply = () => {
    if (parsed && onApplyToForm) {
      onApplyToForm(parsed);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col"
        >
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/60 dark:bg-gray-750">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-tr from-purple-600 to-blue-600 text-white rounded-xl shadow-sm">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Smart Fill with AI</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Paste bank SMS, WhatsApp text, or notes</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-6 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Paste message or transaction note:
              </label>
              <textarea
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. Sent Rs 850 to Blue Tokai for coffee on 28 Sep"
                className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1.5">
                Or try a sample text:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_TEXTS.map((sample, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setText(sample);
                      handleParse(sample);
                    }}
                    className="text-[10px] px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-gray-600 dark:text-gray-300 rounded-lg transition"
                  >
                    "{sample.slice(0, 35)}..."
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs border border-red-100 dark:border-red-900/50">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={() => handleParse()}
              disabled={!text.trim() || loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold transition shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>AI Parsing...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Extract Fields</span>
                </>
              )}
            </button>

            {parsed && (
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check size={12} /> Extracted Successfully
                  </span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    ₹{Number(parsed.amount).toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px]">Vendor</span>
                    <p className="font-semibold text-gray-900 dark:text-white">{parsed.vendor}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px]">Category</span>
                    <p className="font-semibold text-blue-600 dark:text-blue-400">{parsed.category}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px]">Date</span>
                    <p className="font-semibold text-gray-900 dark:text-white">{parsed.date}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px]">Tags</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {parsed.tags?.length > 0 ? (
                        parsed.tags.map((t) => (
                          <span key={t} className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-1.5 py-0.2 rounded">
                            #{t}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">None</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-200/60 dark:border-gray-700">
                  <button
                    onClick={handleSaveDirectly}
                    disabled={saving || saved}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    {saved ? (
                      <>
                        <Check size={14} />
                        <span>Saved to Expenses!</span>
                      </>
                    ) : saving ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Add Directly</span>
                      </>
                    )}
                  </button>

                  {onApplyToForm && (
                    <button
                      onClick={handleApply}
                      className="py-2 px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold text-xs transition flex items-center gap-1"
                    >
                      <span>Edit in Form</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
