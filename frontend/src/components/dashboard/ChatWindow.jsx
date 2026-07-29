import { useEffect, useRef, useState } from "react";
import { Paperclip, ArrowUp, Database, Menu,Loader2 } from "lucide-react";
import { chatService } from "../../api/chatService";
import { useChatStream } from "../../hooks/useChatStream";
import MessageBubble from "./MessageBubble";
import KnowledgeSourcesModal from "./KnowledgeSourcesModal";
import ChatSourcesModal from "./ChatSourcesModal";
import logo from "../../assets/logo.png";

export default function ChatWindow({
  threadId,
  threadTitle,
  onMessageSent,
  openSidebar,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sourcesCount, setSourcesCount] = useState(0);
  const [showAddSources, setShowAddSources] = useState(false);
  const [showSourcesList, setShowSourcesList] = useState(false);
  const bottomRef = useRef(null);
  const { statuses, streamedReply, isStreaming, error, sendMessage } =
    useChatStream();

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      setSourcesCount(0);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await chatService.getThreadMessages(threadId);
        if (!cancelled) setMessages(data);
      } catch (err) {
        if (!cancelled) {
          if (err.response?.status === 404) setMessages([]);
          else console.error("Failed to load thread messages", err);
        }
      }
      try {
        const { data } = await chatService.getThreadSources(threadId);
        if (!cancelled) setSourcesCount(data.length);
      } catch {
        if (!cancelled) setSourcesCount(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamedReply, statuses]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");

    sendMessage(threadId, text, {
      onDone: (reply) => {
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        onMessageSent?.(threadId);
      },
    });
  };

  const refreshSourcesCount = async () => {
    try {
      const { data } = await chatService.getThreadSources(threadId);
      setSourcesCount(data.length);
    } catch {
      setSourcesCount(0);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[dvh] bg-black relative min-w-0">
      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Mobile Menu Toggle */}
          <button
            onClick={openSidebar}
            className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 border border-white/5 transition-all">
            <Menu size={20} />
          </button>

          <div className="min-w-0">
            <h1 className="text-white font-bold text-base md:text-lg truncate">
              {threadTitle || "New Chat"}
            </h1>
            <p className="text-[11px] md:text-xs text-zinc-400 font-medium tracking-wide flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              Research synthesis
            </p>
          </div>
        </div>

        <button
          onClick={() => threadId && setShowSourcesList(true)}
          disabled={!threadId}
          className="shrink-0 flex items-center gap-2 rounded-full bg-purple-500/15 border border-purple-500/20 text-purple-300 text-xs font-bold px-3 py-2 md:px-4 md:py-2 hover:bg-purple-500/25 transition-all disabled:opacity-50">
          <Database size={14} />
          <span>
            {sourcesCount} <span className="hidden sm:inline">Sources</span>
          </span>
        </button>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-track]:bg-transparent scroll-smooth">
        <div className="max-w-4xl mx-auto w-full space-y-6">
          {messages.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center animate-in fade-in duration-500 zoom-in-95">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-500/10 to-indigo-500/10 flex items-center justify-center mb-6 shadow-inner shadow-white/5 border border-white/5">
                <img
                  src={logo}
                  alt="PNX AI"
                  className="w-8 h-8 rounded-full opacity-90"
                />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2 tracking-tight">
                How can I help you today?
              </h2>
              <p className="text-zinc-500 text-sm max-w-sm px-4">
                Connect a knowledge source or simply ask a question to begin
                your research.
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))
          )}

          {isStreaming && (
            <div className="max-w-3xl animate-in slide-in-from-left-4 fade-in duration-300">
              <div className="pl-6 mb-3 space-y-1.5">
                {statuses.map((s, i) => (
                  <p
                    key={i}
                    className="text-[11px] font-mono text-purple-400 flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" /> {s}
                  </p>
                ))}
              </div>
              {streamedReply && (
                <MessageBubble role="assistant" content={streamedReply} />
              )}
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-2xl bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-center">
              <p className="text-sm font-medium text-red-400">{error}</p>
            </div>
          )}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-gradient-to-t from-black via-zinc-950/90 to-transparent">
        <form
          onSubmit={handleSend}
          className="max-w-4xl mx-auto w-full relative">
          <div className="flex items-end gap-2 rounded-3xl bg-zinc-900/60 backdrop-blur-xl border border-white/10 p-2 shadow-2xl focus-within:ring-4 focus-within:ring-purple-500/15 focus-within:border-purple-500/50 transition-all duration-300">
            <button
              type="button"
              onClick={() => threadId && setShowAddSources(true)}
              disabled={!threadId}
              title="Add Knowledge Source"
              className="p-3 text-zinc-400 hover:text-purple-400 hover:bg-white/5 rounded-2xl transition-all disabled:opacity-40 shrink-0">
              <Paperclip size={20} />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Ask PNX AI..."
              rows={1}
              className="flex-1 max-h-32 bg-transparent text-white placeholder-zinc-500 focus:outline-none text-sm md:text-[15px] resize-none py-3.5 px-2 scrollbar-none"
              style={{ minHeight: "44px" }}
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="p-3.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/20 disabled:opacity-40 disabled:shadow-none transition-all active:scale-95 shrink-0">
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          </div>
          <p className="text-center text-[10px] md:text-[11px] text-zinc-500 mt-3 font-medium tracking-wide px-4">
            PNX AI grounds answers in your connected sources and flags anything
            it can't verify.
          </p>
        </form>
      </div>

      {showAddSources && (
        <KnowledgeSourcesModal
          threadId={threadId}
          onClose={() => setShowAddSources(false)}
          onSourceAdded={refreshSourcesCount}
        />
      )}
      {showSourcesList && (
        <ChatSourcesModal
          threadId={threadId}
          onClose={() => setShowSourcesList(false)}
          onAddNew={() => {
            setShowSourcesList(false);
            setShowAddSources(true);
          }}
          onSourcesChanged={refreshSourcesCount}
        />
      )}
    </div>
  );
}
