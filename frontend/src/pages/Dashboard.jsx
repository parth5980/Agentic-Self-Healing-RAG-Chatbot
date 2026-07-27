import { useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import ChatWindow from "../components/dashboard/ChatWindow";
import { useThreads } from "../hooks/useThreads";
import { chatService } from "../api/chatService";

export default function Dashboard() {
  const { threads, bumpThread, removeThread, refresh } = useThreads();
  const [activeThreadId, setActiveThreadId] = useState(null);

  const handleNewChat = () => {
    setActiveThreadId(crypto.randomUUID()); 
  };

  const handleDeleteThread = async (threadId) => {
    if (!confirm("Delete this chat? This can't be undone.")) return;
    try {
      await chatService.deleteThread(threadId);
      removeThread(threadId);
      if (threadId === activeThreadId) setActiveThreadId(null);
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
        onSelectThread={setActiveThreadId}
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
