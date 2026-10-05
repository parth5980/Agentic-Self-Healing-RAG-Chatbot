import { useEffect, useRef, useState } from "react";
import {
  Paperclip,
  ChevronLeft,
  Upload,
  Link2,
  MonitorPlay,
  Loader2,
  ArrowUp,
} from "lucide-react";
import { chatService } from "../../api/chatService";

const OPTIONS = [
  { id: "url", label: "Connect URL", icon: Link2 },
  { id: "youtube", label: "YouTube link", icon: MonitorPlay },
];

export default function KnowledgeSourcesPopover({
  threadId,
  disabled,
  onSourceAdded,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState("menu"); // "menu" | "url" | "youtube"
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const resetAndClose = () => {
    setIsOpen(false);
    setStep("menu");
    setUrl("");
    setError("");
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const { data } = await chatService.ingestFile(threadId, file);
      if (!data.success) throw new Error(data.message);
      onSourceAdded?.();
      resetAndClose();
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || "Could not upload file",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddUrl = async () => {
    if (!url.trim()) return;
    setError("");
    setLoading(true);
    try {
      const call =
        step === "url" ? chatService.ingestUrl : chatService.ingestYoutube;
      const { data } = await call(threadId, url.trim());
      if (!data.success) throw new Error(data.message);
      onSourceAdded?.();
      resetAndClose();
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || "Could not add source",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-label="Add knowledge source"
        title="Add knowledge source"
        className={`p-3 rounded-2xl transition-colors shrink-0 disabled:opacity-40 ${
          isOpen
            ? "text-purple-400 bg-white/5"
            : "text-zinc-400 hover:text-purple-400 hover:bg-white/5"
        }`}>
        <Paperclip size={20} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl shadow-black/40 z-20 overflow-hidden">
          {step === "menu" && (
            <div className="p-1.5">
              <label className="flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
                {loading ? (
                  <Loader2
                    size={17}
                    className="text-purple-400 animate-spin shrink-0"
                  />
                ) : (
                  <Upload size={17} className="text-zinc-400 shrink-0" />
                )}
                {loading ? "Uploading..." : "Upload file"}
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={loading}
                />
              </label>

              {OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setStep(id);
                    setError("");
                  }}
                  disabled={loading}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50">
                  <Icon size={17} className="text-zinc-400 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {(step === "url" || step === "youtube") && (
            <div className="p-3">
              <button
                type="button"
                onClick={() => {
                  setStep("menu");
                  setError("");
                }}
                className="flex items-center gap-3 p-1 mb-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors">
                <ChevronLeft size={14} />
                {step === "url" ? "Connect URL" : "YouTube link"}
              </button>

              <div className="flex items-center flex-col gap-3">
                <input
                  autoFocus
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddUrl();
                    }
                  }}
                  disabled={loading}
                  placeholder={
                    step === "url"
                      ? "https://docs.pnx.ai/..."
                      : "https://youtube.com/watch?v=..."
                  }
                  className="w-full min-w-0 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/60 transition-colors"
                />
                <button
                  type="button"
                  onClick={handleAddUrl}
                  disabled={loading || !url.trim()}
                  aria-label="Add source"
                  className="shrink-0 flex items-center justify-center w-1/2 h-8 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition-colors">
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ArrowUp size={14} />
                  )}
                </button>
              </div>

              {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
