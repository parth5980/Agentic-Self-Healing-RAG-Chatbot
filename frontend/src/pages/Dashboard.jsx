import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import ChatWindow from "../components/dashboard/ChatWindow";
import { useThreads } from "../hooks/useThreads";
import { chatService } from "../api/chatService";

export default function Dashboard() {
  const { threads,loading, bumpThread, removeThread, refresh } = useThreads();
   const { threadId: activeThreadId } = useParams();
   const navigate = useNavigate();

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
    if (!confirm("Delete this chat? This can't be undone.")) return;
    try {
      await chatService.deleteThread(threadId);
      removeThread(threadId);
      if (threadId === activeThreadId) navigate("/", { replace: true });
    } catch (err) {
      console.error("Failed to delete thread", err);
    }
  };

  const handleMessageSent = (threadId) => {
    bumpThread(threadId); // instant client-side reorder
    refresh(); // reconcile with server (real title, exact updatedAt)
  };

  const activeThread = threads.find((t) => t.thread_id === activeThreadId);

  return (
    <div className="flex">
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        onDeleteThread={handleDeleteThread}
      />
      <ChatWindow
        key={activeThreadId} // clean remount on thread switch — no state bleeding between threads
        threadId={activeThreadId}
        threadTitle={activeThread?.title}
        onMessageSent={handleMessageSent}
      />
    </div>
  );
}
