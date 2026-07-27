import { useEffect, useRef, useState } from "react";
import { Paperclip, ArrowUp, Database } from "lucide-react";
import { chatService } from "../../api/chatService";
import { useChatStream } from "../../hooks/useChatStream";
import MessageBubble from "./MessageBubble";
import KnowledgeSourcesModal from "./KnowledgeSourcesModal";
import ChatSourcesModal from "./ChatSourcesModal";

export default function ChatWindow({ threadId, threadTitle, onMessageSent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sourcesCount, setSourcesCount] = useState(0);
  const [showAddSources, setShowAddSources] = useState(false);
  const [showSourcesList, setShowSourcesList] = useState(false);
  const bottomRef = useRef(null);
  const { statuses, streamedReply, isStreaming, error, sendMessage } =
    useChatStream();

  // Load history whenever the active thread changes. A brand-new,
  // client-only thread has no history yet — that's an expected 404.
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

  return (
    <div className="flex-1 flex flex-col h-screen bg-black">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
        <div>
          <h1 className="text-white font-bold">{threadTitle || "New Chat"}</h1>
          <p className="text-xs text-gray-500">Research synthesis</p>
        </div>
        <button
          onClick={() => setShowSourcesList(true)}
          className="flex items-center gap-1.5 rounded-full bg-purple-950/60 border border-purple-800/50 text-purple-300 text-xs font-medium px-3 py-1.5 hover:bg-purple-900/60">
          <Database size={13} /> {sourcesCount} Sources
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            How can I help you today?
          </div>
        ) : (
          messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))
        )}

        {isStreaming && (
          <div className="max-w-2xl space-y-1">
            {statuses.map((s, i) => (
              <p key={i} className="text-xs text-gray-500">
                {s}
              </p>
            ))}
            {streamedReply && (
              <MessageBubble role="assistant" content={streamedReply} />
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-zinc-900">
        <div className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 focus-within:ring-2 focus-within:ring-purple-600">
          <button
            type="button"
            onClick={() => setShowAddSources(true)}
            className="text-gray-500 hover:text-purple-400 p-1">
            <Paperclip size={18} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask PNX AI..."
            className="flex-1 bg-transparent text-white placeholder-gray-600 focus:outline-none text-sm"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 p-2 text-white">
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="text-center text-[11px] text-gray-600 mt-2">
          PNX AI grounds answers in your sources and flags anything it can't
          verify.
        </p>
      </form>

      {showAddSources && (
        <KnowledgeSourcesModal onClose={() => setShowAddSources(false)} />
      )}
      {showSourcesList && (
        <ChatSourcesModal
          threadId={threadId}
          onClose={() => setShowSourcesList(false)}
          onAddNew={() => {
            setShowSourcesList(false);
            setShowAddSources(true);
          }}
        />
      )}
    </div>
  );
}
