import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import ChatWindow from "../components/dashboard/ChatWindow";
import { useThreads } from "../hooks/useThreads";
import { chatService } from "../api/chatService";

export default function Dashboard() {
  const { threads, loading, bumpThread, removeThread, refresh } = useThreads();
  const { threadId: activeThreadId } = useParams();
  const navigate = useNavigate();

  // Mobile sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (activeThreadId || loading) return;
    if (threads.length > 0) {
      navigate(`/chat/${threads[0].thread_id}`, { replace: true });
    } else {
      navigate(`/chat/${crypto.randomUUID()}`, { replace: true });
    }
  }, [activeThreadId, loading, threads, navigate]);

  const handleNewChat = () => navigate(`/chat/${crypto.randomUUID()}`);
  const handleSelectThread = (threadId) => navigate(`/chat/${threadId}`);

  const handleDeleteThread = async (threadId) => {
    if (!window.confirm("Delete this chat? This can't be undone.")) return;
    try {
      await chatService.deleteThread(threadId);
      removeThread(threadId);
      if (threadId === activeThreadId) navigate("/", { replace: true });
    } catch (err) {
      console.error("Failed to delete thread", err);
    }
  };

  const handleMessageSent = (threadId) => {
    bumpThread(threadId);
    refresh();
  };

  const activeThread = threads.find((t) => t.thread_id === activeThreadId);

  return (
    <div className="flex h-[100dvh] w-full bg-black overflow-hidden font-sans selection:bg-purple-500/30">
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        onDeleteThread={handleDeleteThread}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      <ChatWindow
        key={activeThreadId}
        threadId={activeThreadId}
        threadTitle={activeThread?.title}
        onMessageSent={handleMessageSent}
        openSidebar={() => setIsSidebarOpen(true)}
      />
    </div>
  );
}
