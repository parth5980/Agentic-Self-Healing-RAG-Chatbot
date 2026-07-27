import { useEffect, useState } from "react";
import { X, FileText, Link2, Trash2, Loader2, MonitorPlay } from "lucide-react";
import { chatService } from "../../api/chatService";

const ICONS = { pdf: FileText, url: Link2, youtube: MonitorPlay, text: FileText };
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-900">
          <div>
            <h2 className="text-white font-bold">Chat Sources</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              These sources are only available in this conversation.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto px-5 py-4 space-y-5">
          {loading && <p className="text-sm text-gray-500">Loading...</p>}
          {!loading && sources.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">
              No sources yet — add a file, URL, or YouTube link to ground
              answers in this chat.
            </p>
          )}
          {!loading &&
            Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <p className="text-xs font-semibold text-purple-400 tracking-wide mb-2">
                  {LABELS[type] || type.toUpperCase()} · {items.length}
                </p>
                <div className="space-y-2">
                  {items.map((s) => {
                    const Icon = ICONS[s.source_type] || FileText;
                    const isDeleting = deletingId === s.source_id;
                    return (
                      <div
                        key={s.source_id}
                        className="flex items-center gap-3 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2.5">
                        <span className="rounded-lg bg-purple-950 p-1.5 shrink-0">
                          <Icon size={14} className="text-purple-400" />
                        </span>
                        <p className="flex-1 min-w-0 text-sm text-white truncate">
                          {s.display_name}
                        </p>
                        <button
                          onClick={() => handleDelete(s.source_id)}
                          disabled={isDeleting}
                          className="text-gray-500 hover:text-red-400 disabled:opacity-50 shrink-0">
                          {isDeleting ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>

        <div className="p-4 border-t border-zinc-900">
          <button
            onClick={onAddNew}
            className="w-full rounded-lg border border-dashed border-purple-800 text-purple-400 text-sm font-medium py-2.5 hover:bg-purple-950/40">
            + Add New Source
          </button>
        </div>
      </div>
    </div>
  );
}
