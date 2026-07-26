import { useCallback, useRef, useState } from "react";
import { authFetch } from "../api/streamFetch";

export function useChatStream() {
  const [statuses, setStatuses] = useState([]);
  const [streamedReply, setStreamedReply] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const sendMessage = useCallback(
    async (threadId, message, { onDone } = {}) => {
      setStatuses([]);
      setStreamedReply("");
      setError(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await authFetch("/chat/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, message }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body)
          throw new Error(`Server responded with ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop();

          for (const event of events) {
            const line = event.trim();
            if (!line.startsWith("data:")) continue;
            const payload = JSON.parse(line.slice(5).trim());

            if (payload.type === "status")
              setStatuses((prev) => [...prev, payload.message]);
            else if (payload.type === "answer") {
              finalContent = payload.content;
              setStreamedReply(payload.content);
            } else if (payload.type === "error")
              throw new Error(payload.message);
            else if (payload.type === "done") onDone?.(finalContent);
          }
        }
      } catch (err) {
        if (err.name !== "AbortError")
          setError(err.message || "Something went wrong");
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [],
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return { statuses, streamedReply, isStreaming, error, sendMessage, cancel };
}
