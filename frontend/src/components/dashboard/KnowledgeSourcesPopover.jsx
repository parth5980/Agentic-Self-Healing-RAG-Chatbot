import { useRef, useState } from "react";
import {
  useFloating,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  offset,
  flip,
  shift,
  size,
  arrow,
  FloatingPortal,
  FloatingFocusManager,
  FloatingArrow,
} from "@floating-ui/react";
import {
  Paperclip,
  X,
  Upload,
  Link2,
  MonitorPlay,
  Loader2,
} from "lucide-react";
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

/**
 * The paperclip trigger AND its popover live in the same component on
 * purpose: floating-ui needs a ref to both the "reference" element (the
 * button) and the "floating" element (the panel) to compute position, so
 * keeping them together is what lets the panel track the button reliably
 * at every screen size instead of using guessed absolute offsets.
 */
export default function KnowledgeSourcesPopover({
  threadId,
  disabled,
  onSourceAdded,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("file");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const arrowRef = useRef(null);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "top-start",
    middleware: [
      // Gap between the paperclip and the panel, leaving room for the arrow.
      offset(14),
      // Flips to bottom-start if there isn't enough room above (e.g. a
      // short viewport, or the composer sitting near the top of the screen).
      flip(),
      // Slides the panel sideways instead of letting it run off-screen -
      // this is what keeps it fully visible on narrow phone widths.
      shift({ padding: 12 }),
      // Caps the panel's own size to whatever space is actually available,
      // so it can never overflow the viewport even after shift/flip.
      size({
        padding: 12,
        apply({ availableWidth, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxWidth: `${Math.min(availableWidth, 420)}px`,
            maxHeight: `${availableHeight}px`,
          });
        },
      }),
      arrow({ element: arrowRef }),
    ],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

  const resetAndClose = () => {
    setIsOpen(false);
    setError("");
    setUrl("");
    setActiveTab("file");
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
        activeTab === "url" ? chatService.ingestUrl : chatService.ingestYoutube;
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
    <>
      <button
        ref={refs.setReference}
        type="button"
        disabled={disabled}
        title="Add knowledge source"
        className="p-3 text-zinc-400 hover:text-purple-400 hover:bg-white/5 rounded-2xl transition-all disabled:opacity-40 shrink-0"
        {...getReferenceProps()}>
        <Paperclip size={20} />
      </button>

      {isOpen && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className="z-[60] w-[calc(100vw-2rem)] sm:w-96 rounded-3xl bg-zinc-900/95 border border-white/10 shadow-2xl shadow-purple-900/30 backdrop-blur-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              {...getFloatingProps()}>
              <FloatingArrow
                ref={arrowRef}
                context={context}
                width={16}
                height={8}
                fill="#18181b"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={1}
              />

              <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                <h2 className="text-white font-semibold text-lg tracking-tight">
                  Knowledge Sources
                </h2>
                <button
                  onClick={resetAndClose}
                  className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-track]:bg-transparent">
                <div>
                  <p className="text-[11px] font-bold text-purple-400/80 tracking-widest uppercase mb-3">
                    Add Source
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {TABS.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
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
                </div>

                {activeTab === "file" && (
                  <label
                    className={`flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-2 transition-all ${
                      loading
                        ? "border-white/5 bg-white/[0.02] opacity-50"
                        : "border-zinc-700 bg-black/30 cursor-pointer hover:border-purple-500/60 hover:bg-purple-500/10"
                    }`}>
                    <div className="p-2 bg-white/5 rounded-full">
                      {loading ? (
                        <Loader2
                          size={24}
                          className="text-purple-400 animate-spin"
                        />
                      ) : (
                        <Upload size={12} className="text-purple-400" />
                      )}
                    </div>
                    <div className="text-center">
                      <span className="block text-sm text-zinc-200 font-semibold mb-1">
                        {loading
                          ? "Processing document..."
                          : "Choose a file to upload"}
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
                  <div className="flex gap-2">
                    <div className="relative flex-1 min-w-0">
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
                            ? "https://docs.pnx.ai/architecture"
                            : "https://youtube.com/watch?v=..."
                        }
                        className="w-full rounded-xl bg-black/40 border border-white/10 pl-10 pr-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/60 focus:bg-white/[0.05] focus:ring-4 focus:ring-purple-500/10 transition-all"
                      />
                    </div>
                    <button
                      onClick={handleAddUrl}
                      disabled={loading || !url.trim()}
                      type="button"
                      className="shrink-0 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-5 text-sm font-bold text-white shadow-lg shadow-purple-900/20 transition-all active:scale-[0.98]">
                      {loading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        "Add URL"
                      )}
                    </button>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-400 text-center font-medium">
                      {error}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
