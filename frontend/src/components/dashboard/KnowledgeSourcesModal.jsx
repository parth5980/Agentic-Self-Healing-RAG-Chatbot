import { useState } from "react";
import { X, Upload, Link2, MonitorPlay } from "lucide-react";

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

export default function KnowledgeSourcesModal({ onClose }) {
  const [activeTab, setActiveTab] = useState("file");
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");

  // Ingest isn't wired to Express yet — every action here is a no-op.
  const handleComingSoon = () => setNotice("Adding sources is coming soon.");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4"
      onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-zinc-950 border border-purple-900/40 shadow-2xl shadow-purple-950/50 mb-24"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-900">
          <h2 className="text-white font-bold">Knowledge Sources</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs font-semibold text-purple-400 tracking-wide">
            ADD SOURCE
          </p>

          <div className="grid grid-cols-3 gap-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setNotice("");
                  }}
                  className={`flex flex-col items-center text-center gap-1.5 rounded-xl border px-2 py-3 transition-colors ${
                    isActive
                      ? "border-purple-500 bg-purple-950/40"
                      : "border-zinc-800 hover:border-zinc-700"
                  }`}>
                  <span
                    className={`rounded-lg p-1.5 ${isActive ? "bg-purple-600" : "bg-zinc-800"}`}>
                    <Icon size={16} className="text-white" />
                  </span>
                  <span className="text-xs font-semibold text-white">
                    {tab.label}
                  </span>
                  <span className="text-[10px] text-gray-500">{tab.hint}</span>
                </button>
              );
            })}
          </div>

          {activeTab === "file" && (
            <label className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-700 py-6 cursor-pointer hover:border-purple-500">
              <Upload size={18} className="text-purple-400" />
              <span className="text-sm text-purple-300 font-medium">
                Choose a file to upload
              </span>
              <span className="text-xs text-gray-500">PDF, DOCX, or TXT</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={handleComingSoon}
              />
            </label>
          )}

          {(activeTab === "url" || activeTab === "youtube") && (
            <div className="flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  activeTab === "url"
                    ? "https://docs.pnx.ai/architecture"
                    : "https://youtube.com/watch?v=..."
                }
                className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              <button
                onClick={handleComingSoon}
                className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 text-sm font-semibold text-white">
                {activeTab === "url" ? "Add URL" : "Add Video"}
              </button>
            </div>
          )}

          {notice && (
            <p className="text-xs text-amber-400 text-center">{notice}</p>
          )}
        </div>
      </div>
    </div>
  );
}
