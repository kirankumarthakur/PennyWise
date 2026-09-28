import React, { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, Bot, User, RefreshCw, ChevronUp, ChevronDown, Key, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../../config/api";
import { useAiKey } from "../../context/AiKeyContext";

const QUICK_PROMPTS = [
  "How much did I spend this week?",
  "Am I pacing within my monthly budget?",
  "What is my highest spending category?",
  "Give me 3 ways to cut expenses this month"
];

export default function AiChatDrawer() {
  const { apiKey, setApiKey, provider, hasKey } = useAiKey();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I am your PennyWise AI Copilot. Ask me anything about your spending habits, budget pacing, or recent transactions."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [drawerKeyInput, setDrawerKeyInput] = useState("");
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSaveDrawerKey = () => {
    if (drawerKeyInput.trim()) {
      setApiKey(drawerKeyInput.trim());
      setShowKeyPrompt(false);
      setDrawerKeyInput("");
    }
  };

  const handleSend = async (messageText = null) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || loading) return;

    if (!hasKey) {
      setShowKeyPrompt(true);
      return;
    }

    const userMessage = { role: "user", content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const historyPayload = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: historyPayload
        })
      });

      const data = await res.json();
      if (data.success && data.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: data.error || "Failed to receive response from AI. Please check your API key in Settings."
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Cannot connect to PennyWise AI backend. Ensure the server is running."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
        >
          <Sparkles size={18} className="text-yellow-300 animate-pulse" />
          <span className="text-xs font-bold tracking-wide">
            {isOpen ? "Close Copilot" : "Ask PennyWise AI"}
          </span>
          {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-6 z-40 w-96 max-w-[calc(100vw-3rem)] h-[520px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3.5 bg-gray-50/80 dark:bg-gray-750 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-lg shadow-sm">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white">PennyWise Copilot</h3>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    {hasKey ? `${provider.toUpperCase()} Key In-Memory` : "Key Needed (Memory Only)"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-700 transition"
              >
                <X size={16} />
              </button>
            </div>

            {(!hasKey || showKeyPrompt) && (
              <div className="bg-amber-50 dark:bg-amber-950/50 p-3 border-b border-amber-200 dark:border-amber-800 text-[11px] space-y-2">
                <div className="flex items-center justify-between text-amber-900 dark:text-amber-200 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Key size={13} />
                    <span>Enter {provider.toUpperCase()} API Key:</span>
                  </span>
                  {showKeyPrompt && hasKey && (
                    <button
                      onClick={() => setShowKeyPrompt(false)}
                      className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    value={drawerKeyInput}
                    onChange={(e) => setDrawerKeyInput(e.target.value)}
                    placeholder="Paste API key (in-memory only)..."
                    className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                  <button
                    onClick={handleSaveDrawerKey}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition"
                  >
                    Set Key
                  </button>
                </div>
                <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80">
                  Key is held in volatile memory and never stored on the server.
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 text-xs">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2.5 w-full max-w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={13} />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] overflow-x-hidden ${
                      m.role === "user"
                        ? "bg-blue-600 text-white font-medium rounded-br-none"
                        : "bg-gray-100 dark:bg-gray-700/70 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-100 dark:border-gray-600"
                    }`}
                  >
                    {m.content}
                  </div>

                  {m.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={13} />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={13} />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700/70 rounded-2xl px-3.5 py-2 text-gray-500 rounded-bl-none flex items-center gap-1.5 text-xs">
                    <RefreshCw size={12} className="animate-spin text-blue-600" />
                    <span>Analyzing your finances...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-750/50 border-t border-gray-100 dark:border-gray-700 overflow-x-auto flex gap-1.5 no-scrollbar scroll-smooth">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                  className="whitespace-nowrap px-2.5 py-1 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-[10px] font-medium transition shrink-0"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={hasKey ? "Ask a question about your spending..." : "Enter key above, then ask a question..."}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl transition shadow-sm"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
