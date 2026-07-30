import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../api/streamFetch";

const TYPE_SPEED_MS = 12; // ms per character — tune to taste
const REVEAL_TOTAL_MS = 5000; // the whole answer reveals within ~5s, no matter its length
const TICK_MS = 20;

export function useChatStream() {
  const [statuses, setStatuses] = useState([]);
  const [streamedReply, setStreamedReply] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const typeTimerRef = useRef(null);

  const stopTyping = () => {
    if (typeTimerRef.current) {
      clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }
  };

  useEffect(() => () => stopTyping(), []);

  const sendMessage = useCallback(
    async (threadId, message, { onDone } = {}) => {
      setStatuses([]);
      setStreamedReply("");
      setError(null);
      setIsStreaming(true);
      stopTyping();

      const controller = new AbortController();
      abortRef.current = controller;

      const finishUp = (finalContent) => {
        setIsStreaming(false);
        setStreamedReply("");
        setStatuses([]);
        onDone?.(finalContent);
      };

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
        let doneReceived = false;

        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop();

          for (const event of events) {
            const line = event.trim();
            if (!line.startsWith("data:")) continue;
            const payload = JSON.parse(line.slice(5).trim());

            if (payload.type === "status") {
              setStatuses((prev) => [...prev, payload.message]);
            } else if (payload.type === "answer") {
              finalContent = payload.content;
              const totalTicks = Math.max(
                1,
                Math.round(REVEAL_TOTAL_MS / TICK_MS),
              );
              const chunkSize = Math.max(
                1,
                Math.ceil(finalContent.length / totalTicks),
              );
              let i = 0;
              stopTyping();
              typeTimerRef.current = setInterval(() => {
                i = Math.min(i + chunkSize, finalContent.length);
                setStreamedReply(finalContent.slice(0, i));
                if (i >= finalContent.length) {
                  stopTyping();
                  if (doneReceived) finishUp(finalContent);
                }
              }, TICK_MS);
            } else if (payload.type === "error") {
              throw new Error(payload.message);
            } else if (payload.type === "done") {
              doneReceived = true;
              if (!typeTimerRef.current) finishUp(finalContent); // typing already caught up (or was never started)
              break outer;
            }
          }
        }
      } catch (err) {
        stopTyping();
        if (err.name !== "AbortError")
          setError(err.message || "Something went wrong");
        setIsStreaming(false);
      } finally {
        abortRef.current = null;
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    stopTyping();
    abortRef.current?.abort();
  }, []);

  return { statuses, streamedReply, isStreaming, error, sendMessage, cancel };
}
