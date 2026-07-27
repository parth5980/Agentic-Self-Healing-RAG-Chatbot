import { useCallback, useEffect, useState } from "react";
import { chatService } from "../api/chatService";

export function useThreads() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await chatService.getThreads();
      setThreads(data);
    } catch (err) {
      console.error("Failed to load threads", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Optimistic bump so the sidebar re-sorts instantly on send, without
  // waiting on a full refetch to see the new updatedAt.
  const bumpThread = useCallback((threadId, patch = {}) => {
    setThreads((prev) => {
      const existing = prev.find((t) => t.thread_id === threadId);
      const updated = {
        ...(existing || { thread_id: threadId }),
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      const rest = prev.filter((t) => t.thread_id !== threadId);
      return [updated, ...rest];
    });
  }, []);

  const removeThread = useCallback((threadId) => {
    setThreads((prev) => prev.filter((t) => t.thread_id !== threadId));
  }, []);

  return { threads, loading, refresh, bumpThread, removeThread };
}
