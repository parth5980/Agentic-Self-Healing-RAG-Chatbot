import { useEffect, useState } from "react";
import {
  X,
  FileText,
  Link2,
  Trash2,
  Loader2,
  MonitorPlay,
  Plus,
  Database,
} from "lucide-react";
import { chatService } from "../../api/chatService";

const ICONS = {
  pdf: FileText,
  url: Link2,
  youtube: MonitorPlay,
  text: FileText,
};
const LABELS = {
  pdf: "FILES",
  url: "URLS",
  youtube: "YOUTUBE LINKS",
  text: "TEXT",
};

export default function ChatSourcesModal({
  threadId,
  onClose,
  onAddNew,
  onSourcesChanged,
}) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await chatService.getThreadSources(threadId);
        setSources(data);
      } catch {
        setSources([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [threadId]);

  const handleDelete = async (sourceId) => {
    setDeletingId(sourceId);
    try {
      await chatService.deleteThreadSource(threadId, sourceId);
      setSources((prev) => prev.filter((s) => s.source_id !== sourceId));
      onSourcesChanged?.();
    } catch (err) {
      console.error("Failed to delete source", err);
    } finally {
      setDeletingId(null);
    }
  };

  const grouped = sources.reduce((acc, s) => {
    (acc[s.source_type] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl bg-zinc-900/90 border border-white/10 shadow-2xl shadow-purple-900/20 overflow-hidden backdrop-blur-xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
          <div>
            <h2 className="text-white font-semibold text-lg tracking-tight">
              Chat Sources
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-medium">
              These sources ground the answers in this specific conversation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5 space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-track]:bg-transparent">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 size={24} className="text-purple-500 animate-spin" />
              <p className="text-sm text-zinc-500 font-medium">
                Loading sources...
              </p>
            </div>
          )}
          {!loading && sources.length === 0 && (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Database size={20} className="text-zinc-500" />
              </div>
              <p className="text-sm text-zinc-400 font-medium leading-relaxed">
                No sources connected yet. <br /> Add files, websites, or videos
                to get started.
              </p>
            </div>
          )}
          {!loading &&
            Object.entries(grouped).map(([type, items]) => (
              <div key={type} className="space-y-3">
                <p className="text-[11px] font-bold text-purple-400/80 tracking-widest uppercase flex items-center gap-2">
                  {LABELS[type] || type.toUpperCase()}
                  <span className="px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px]">
                    {items.length}
                  </span>
                </p>
                <div className="space-y-2">
                  {items.map((s) => {
                    const Icon = ICONS[s.source_type] || FileText;
                    const isDeleting = deletingId === s.source_id;
                    return (
                      <div
                        key={s.source_id}
                        className="group flex items-center gap-3 rounded-2xl bg-white/[0.03] border border-white/5 px-4 py-3 hover:bg-white/[0.06] hover:border-white/10 transition-all">
                        <span className="rounded-xl bg-purple-500/10 p-2 shrink-0 group-hover:scale-110 transition-transform shadow-inner shadow-white/5">
                          <Icon size={16} className="text-purple-400" />
                        </span>
                        <p className="flex-1 min-w-0 text-sm font-medium text-zinc-200 truncate">
                          {s.display_name}
                        </p>
                        <button
                          onClick={() => handleDelete(s.source_id)}
                          disabled={isDeleting}
                          className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-50 shrink-0 transition-colors">
                          {isDeleting ? (
                            <Loader2
                              size={16}
                              className="animate-spin text-red-400"
                            />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>

        <div className="p-5 border-t border-white/5 bg-black/20">
          <button
            onClick={onAddNew}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-purple-500/40 bg-purple-500/5 text-purple-300 text-sm font-semibold py-3 hover:bg-purple-500/15 hover:border-purple-500/60 transition-all active:scale-[0.98]">
            <Plus size={16} />
            Add New Source
          </button>
        </div>
      </div>
    </div>
  );
}
