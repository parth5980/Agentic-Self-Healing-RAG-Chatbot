import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  MessageSquare,
  Trash2,
  ChevronLeft,
  Settings,
  Info,
  LogOut,
} from "lucide-react";
import logo from "../../assets/logo.png";
import { useAuth } from "../../hooks/useAuth";

export default function Sidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
}) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`shrink-0 bg-black border-r border-zinc-900 flex flex-col h-screen transition-all duration-300 ${
        collapsed ? "w-20" : "w-72"
      }`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={logo}
              alt="PNX AI"
              className="w-8 h-8 rounded-lg shrink-0"
            />
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-bold text-purple-300 leading-tight text-sm truncate">
                  PNX AI
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide truncate">
                  Agentic Intelligence
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-gray-500 hover:text-white shrink-0 p-1"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <ChevronLeft
              size={18}
              className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        <button
          onClick={onNewChat}
          title="New Chat"
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-600 hover:bg-purple-500 py-2.5 font-semibold text-white text-sm transition-colors">
          <Plus size={16} /> {!collapsed && "New Chat"}
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-2">
        {!collapsed && (
          <p className="px-3 mb-1 text-xs font-bold uppercase tracking-widest text-gray-600">
            Chats
          </p>
        )}

        <div className="space-y-1">
          {threads.map((t) => {
            const isActive = t.thread_id === activeThreadId;
            return (
              <div
                key={t.thread_id}
                onClick={() => onSelectThread(t.thread_id)}
                title={collapsed ? t.title || "New Chat" : undefined}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                  isActive
                    ? "bg-purple-950/60 text-white"
                    : "text-gray-400 hover:bg-zinc-900"
                } ${collapsed ? "justify-center" : ""}`}>
                <MessageSquare size={15} className="shrink-0 opacity-60" />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">
                      {t.title || "New Chat"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteThread(t.thread_id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
          {threads.length === 0 && !collapsed && (
            <p className="text-xs text-gray-600 text-center mt-6">
              No chats yet
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-900 p-3 space-y-3">
        <div
          className={`flex items-center gap-2 px-1 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {user?.username?.[0]?.toUpperCase() || "Adam"}
          </div>
          {!collapsed && (
            <p className="text-sm text-white font-semibold truncate">
              {user?.username}
            </p>
          )}
        </div>

        <nav className="space-y-1">
          <Link
            to="/settings"
            title={collapsed ? "Settings" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors ${collapsed ? "justify-center" : ""}`}>
            <Settings size={16} /> {!collapsed && "Settings"}
          </Link>
          <Link
            to="/about"
            title={collapsed ? "About" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors ${collapsed ? "justify-center" : ""}`}>
            <Info size={16} /> {!collapsed && "About"}
          </Link>
          <button
            onClick={logout}
            title={collapsed ? "Logout" : undefined}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors ${collapsed ? "justify-center" : ""}`}>
            <LogOut size={16} /> {!collapsed && "Logout"}
          </button>
        </nav>
      </div>
    </aside>
  );
}
