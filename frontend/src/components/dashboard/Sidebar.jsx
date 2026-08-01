// Sidebar.jsx
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
  X,
} from "lucide-react";
import logo from "../../assets/logo.png";
import { useAuth } from "../../hooks/useAuth";

export default function Sidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  isOpen,
  setIsOpen,
}) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 flex flex-col h-[dvh] bg-zinc-950 border-r border-white/5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] w-72 ${
          collapsed ? "md:w-20" : "md:w-72"
        } ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="p-5">
          <div
            className={`flex items-center mb-6 ${collapsed ? "md:flex-col md:gap-3" : "justify-between"}`}>
            <div
              className={`flex items-center gap-3 ${collapsed ? "md:justify-center" : ""}`}>
                <img
                  src={logo}
                  alt="PNX AI"
                  className={`w-9 h-9 rounded-xl shadow-lg border border-white/10 shrink-0`}
                />

              {!collapsed && (
                <div className="md:block">
                  <h1 className="font-bold text-white text-[15px] leading-tight tracking-wide">
                    PNX AI
                  </h1>
                  <p className="text-[9px] font-bold text-purple-400/80 uppercase tracking-[0.2em]">
                    Agentic Intelligence
                  </p>
                </div>
              )}
            </div>

            {/* Mobile: close drawer entirely */}
            <button
              onClick={() => setIsOpen(false)}
              className="md:hidden text-zinc-500 hover:text-white p-1.5 rounded-lg transition-colors">
              <X size={20} />
            </button>

            {/* Desktop: collapse to mini-rail — visible at all times, not just mobile */}
            <button
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden md:flex text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <ChevronLeft
                size={18}
                className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          <button
            onClick={() => {
              onNewChat();
              setIsOpen(false);
            }}
            title="New Chat"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-900/20 py-3 font-bold text-white text-sm transition-all active:scale-[0.98]">
            <Plus size={18} />{" "}
            {!collapsed && <span className="md:inline">New Chat</span>}
          </button>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-track]:bg-transparent">
          {!collapsed && (
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 md:block">
              Conversations
            </p>
          )}

          <div className="space-y-1">
            {threads.map((t) => {
              const isActive = t.thread_id === activeThreadId;
              return (
                <div
                  key={t.thread_id}
                  onClick={() => {
                    onSelectThread(t.thread_id);
                    setIsOpen(false);
                  }}
                  title={collapsed ? t.title || "New Chat" : undefined}
                  className={`group flex items-center gap-3 rounded-xl h-10 px-3 py-2 cursor-pointer text-sm font-medium transition-all ${
                    isActive
                      ? "bg-purple-500/15 text-white border-l-2 border-purple-500"
                      : "text-zinc-400 hover:bg-white/4 hover:text-zinc-200 border-l-2 border-transparent"
                  } ${collapsed ? "md:justify-center" : ""}`}>
                  <MessageSquare
                    size={16} 
                    className={`shrink-0 ${isActive ? "text-purple-400" : "text-zinc-600"}`}
                  />
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1 md:block">
                        {t.title || "New Chat"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteThread(t.thread_id);
                        }}
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 shrink-0 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            {threads.length === 0 && !collapsed && (
              <div className="text-center py-8 px-4 md:block">
                <MessageSquare
                  size={20}
                  className="mx-auto text-zinc-700 mb-2"
                />
                <p className="text-xs text-zinc-500 font-medium">
                  No conversations yet
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 mt-auto border-t border-white/5 bg-zinc-950">
          <div
            className={`flex items-center gap-3 px-2 py-2 mb-2 ${collapsed ? "md:justify-center" : ""}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md">
              {user?.username?.[0]?.toUpperCase() || "U"}
            </div>
            {!collapsed && (
              <div className="min-w-0 md:block">
                <p className="text-sm text-white font-semibold truncate leading-tight">
                  {user?.username || "Guest User"}
                </p>
              </div>
            )}
          </div>

          <nav className="space-y-0.5">
            <Link
              to="/settings"
              title={collapsed ? "Settings" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors ${collapsed ? "md:justify-center" : ""}`}>
              <Settings size={16} className="shrink-0" />{" "}
              {!collapsed && "Settings"}
            </Link>
            <Link
              to="/about"
              title={collapsed ? "About" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors ${collapsed ? "md:justify-center" : ""}`}>
              <Info size={16} className="shrink-0" /> {!collapsed && "About"}
            </Link>
            <button
              onClick={logout}
              title={collapsed ? "Logout" : undefined}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ${collapsed ? "md:justify-center" : ""}`}>
              <LogOut size={16} className="shrink-0" /> {!collapsed && "Logout"}
            </button>
          </nav>
        </div>
      </aside>
    </>
  );
}
