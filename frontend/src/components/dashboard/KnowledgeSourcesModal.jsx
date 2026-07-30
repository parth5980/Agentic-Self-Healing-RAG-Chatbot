import { useState } from "react";
import { X, Upload, Link2, MonitorPlay, Loader2 } from "lucide-react";
import { chatService } from "../../api/chatService";

const TABS = [
  { id: "file", label: "Upload File", hint: "PDF, DOCX, TXT", icon: Upload },
  { id: "url", label: "Connect URL", hint: "Web Scraping", icon: Link2 },
  {
    id: "youtube",
    label: "YouTube Link",
    hint: "Transcript Processing",
    icon: MonitorPlay,
  },
];

export default function KnowledgeSourcesModal({
  threadId,
  onClose,
  onSourceAdded,
}) {
  const [activeTab, setActiveTab] = useState("file");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const { data } = await chatService.ingestFile(threadId, file);
      if (!data.success) throw new Error(data.message);
      onSourceAdded?.();
      onClose();
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
        activeTab === "url" ? chatService.ingestUrl : chatService.ingestYoutube;
      const { data } = await call(threadId, url.trim());
      if (!data.success) throw new Error(data.message);
      setUrl("");
      onSourceAdded?.();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || "Could not add source",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center md:items-end justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl bg-zinc-900/90 border border-white/10 shadow-2xl shadow-purple-900/30 md:mb-10 overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
          <h2 className="text-white font-semibold text-lg tracking-tight">
            Add Knowledge
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setError("");
                  }}
                  disabled={loading}
                  className={`group flex flex-col items-center text-center gap-2 rounded-2xl border px-2 py-4 transition-all duration-300 disabled:opacity-50 ${
                    isActive
                      ? "border-purple-500/50 bg-purple-500/10 shadow-[inset_0_0_15px_rgba(168,85,247,0.15)]"
                      : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10"
                  }`}>
                  <span
                    className={`rounded-xl p-2.5 transition-colors ${
                      isActive
                        ? "bg-purple-600 shadow-md shadow-purple-900/50"
                        : "bg-white/5 group-hover:bg-white/10"
                    }`}>
                    <Icon
                      size={18}
                      className={
                        isActive
                          ? "text-white"
                          : "text-zinc-400 group-hover:text-zinc-200"
                      }
                    />
                  </span>
                  <div>
                    <span
                      className={`block text-xs font-semibold ${isActive ? "text-purple-200" : "text-zinc-300"}`}>
                      {tab.label}
                    </span>
                    <span className="block text-[10px] text-zinc-500 mt-0.5">
                      {tab.hint}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {activeTab === "file" && (
            <label
              className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-10 transition-all ${
                loading
                  ? "border-white/5 bg-white/[0.02] opacity-50"
                  : "border-zinc-700 bg-black/30 cursor-pointer hover:border-purple-500/60 hover:bg-purple-500/10"
              }`}>
              <div className="p-3 bg-white/5 rounded-full">
                {loading ? (
                  <Loader2 size={24} className="text-purple-400 animate-spin" />
                ) : (
                  <Upload size={24} className="text-purple-400" />
                )}
              </div>
              <div className="text-center">
                <span className="block text-sm text-zinc-200 font-semibold mb-1">
                  {loading
                    ? "Processing document..."
                    : "Click to select a file"}
                </span>
                <span className="block text-xs text-zinc-500 font-medium">
                  Supports PDF, DOCX, or TXT
                </span>
              </div>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={handleFileChange}
                disabled={loading}
              />
            </label>
          )}

          {(activeTab === "url" || activeTab === "youtube") && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {activeTab === "url" ? (
                    <Link2 size={16} className="text-zinc-500" />
                  ) : (
                    <MonitorPlay size={16} className="text-zinc-500" />
                  )}
                </div>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  placeholder={
                    activeTab === "url"
                      ? "https://docs.pnx.ai/guide"
                      : "https://youtube.com/watch?v=..."
                  }
                  className="w-full rounded-xl bg-black/40 border border-white/10 pl-10 pr-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/60 focus:bg-white/[0.05] focus:ring-4 focus:ring-purple-500/10 transition-all"
                />
              </div>
              <button
                onClick={handleAddUrl}
                disabled={loading || !url.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-900/20 transition-all active:scale-[0.98]">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Fetching
                    Content...
                  </span>
                ) : (
                  "Connect Source"
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-top-2">
              <p className="text-xs text-red-400 text-center font-medium">
                {error}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
