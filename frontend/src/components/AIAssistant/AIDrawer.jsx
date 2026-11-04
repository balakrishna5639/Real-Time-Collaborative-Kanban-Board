import React, { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { X, Sparkles, Send, Bot, User, Wrench, RefreshCw } from 'lucide-react';

const SUGGESTIONS = [
  '📊 Summarize board progress',
  '⚠️ Show overdue tasks in this branch',
  '🔥 What are the most urgent tasks?',
  '📋 Summarize today’s branch activity'
];

export const AIDrawer = ({ isOpen, onClose }) => {
  const { activeTenant, user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello ${user?.name?.split(' ')[0] || 'there'}! I am your AI Kanban Assistant for the **${activeTenant?.name || 'current'}** branch.\n\nI can analyze team velocity, surface overdue tasks, find critical bottlenecks, or summarize recent branch updates. How can I help you?`,
      toolUsed: null
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (queryText) => {
    const text = queryText || input;
    if (!text.trim() || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.askAI(text);
      if (res.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.reply,
            toolUsed: res.toolUsed,
            source: res.source
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Apologies, I encountered an issue: ${res.error || 'Failed to process request'}`
          }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error contacting AI agent: ${err.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                Kanban AI Agent
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-800/60 rounded">
                  Tenant Scoped
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Context: {activeTenant?.name} Branch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 ${
                m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-indigo-400" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-md'
                    : 'bg-slate-950/80 text-slate-200 border border-slate-800/80 rounded-bl-none shadow-sm'
                }`}
              >
                {/* Tool Badge */}
                {m.toolUsed && (
                  <div className="flex items-center gap-1 text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/60 mb-2 w-fit">
                    <Wrench className="w-2.5 h-2.5" /> tool: {m.toolUsed}
                  </div>
                )}

                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>

              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 w-fit">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Analyzing branch task data...</span>
            </div>
          )}
        </div>

        {/* Prompt Suggestion Chips */}
        <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/30 flex gap-2 overflow-x-auto">
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(s)}
              disabled={loading}
              className="text-[11px] whitespace-nowrap bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-full border border-slate-700/80 transition"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder={`Ask about ${activeTenant?.name} tasks...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

