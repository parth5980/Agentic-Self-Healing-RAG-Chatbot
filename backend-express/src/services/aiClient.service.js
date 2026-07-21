import config from "../config/config.js";

/**
 * Calls backend-ai's POST /chat, which streams Server-Sent Events:
 *   {type: "status", message}  -> intermediate pipeline step (optional to use)
 *   {type: "answer", content} -> the final answer text
 *   {type: "done"}            -> stream finished
 *   {type: "error", message}  -> pipeline failed
 *
 * This function drains the whole stream server-side and resolves with the
 * final answer, so the rest of your Express app can keep treating chat as a
 * simple request/response call for now. Pass `onStatus` if you want to see
 * (or later, forward) the intermediate status messages.
 *
 * @param {Object} params
 * @param {string} params.message      Current user question
 * @param {string} params.threadId     Thread id (matches backend-ai's thread_id)
 * @param {Array<{role: string, content: string}>} [params.chatHistory] Prior turns only — do NOT include the current message here, backend-ai already receives it separately.
 * @param {(status: string) => void} [params.onStatus] Optional callback for live status updates
 */
export async function getAIResponse({
  message,
  threadId,
  chatHistory = [],
  onStatus,
}) {
  let response;

  try {
    response = await fetch(`${config.AI_BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        thread_id: threadId,
        chat_history: chatHistory,
      }),
    });
  } catch (err) {
    // Most commonly: backend-ai isn't running, or AI_BACKEND_URL is wrong
    throw new Error(`Could not reach AI backend: ${err.message}`);
  }

  if (!response.ok || !response.body) {
    throw new Error(`AI backend responded with status ${response.status}`);
  }

  //   console.log(response);

  // Read the SSE stream from backend-ai and parse it
  const reader = response.body.getReader(); // ReadableStreamDefaultReader<Uint8Array>
  const decoder = new TextDecoder(); // Decode Uint8Array chunks into strings
  let buffer = "";
  let finalAnswer = null;

  // Read the stream until it's done, parsing SSE events as they arrive
  while (true) {
    const { done, value } = await reader.read(); // { done: boolean, value: Uint8Array }
    if (done) break; // Stream finished

    buffer += decoder.decode(value, { stream: true }); // Append new chunk to buffer

    // SSE events are separated by a blank line ("\n\n")
    const events = buffer.split("\n\n");
    buffer = events.pop(); // last chunk may be incomplete, keep it for next read

    // Process each complete SSE event
    for (const event of events) {
      const line = event.trim(); // Skip empty lines
      if (!line.startsWith("data:")) continue; // Only process lines starting with "data:"

      const payload = JSON.parse(line.slice(5).trim()); // Parse the JSON after "data:"

      // Handle the payload based on its type
      if (payload.type === "status") {
        // Intermediate status message
        onStatus?.(payload.message); // Call the optional callback with the status message
      } else if (payload.type === "answer") {
        // Final answer from the AI backend
        finalAnswer = payload.content; // Store the final answer, but keep reading until we get a "done" event
      } else if (payload.type === "error") {
        // Pipeline failed, throw an error with the message
        throw new Error(`AI backend pipeline error: ${payload.message}`);
      }
    }
  }

  if (finalAnswer === null) {
    throw new Error("AI backend stream ended without producing an answer");
  }

  return finalAnswer;
}

/**
 * Forwards a source to backend-ai's POST /ingest so it gets chunked,
 * embedded, and upserted into Pinecone. backend-ai expects
 * multipart/form-data (FastAPI Form/File), never JSON, so this always
 * builds a FormData body — even for a plain URL or text string.
 *
 * @param {Object} params
 * @param {"pdf"|"url"|"youtube"|"text"} params.sourceType
 * @param {string} [params.source] Required for url/youtube/text — the URL or raw text
 * @param {{buffer: Buffer, originalname: string, mimetype: string}} [params.file] Required for pdf — this is req.file from multer's memoryStorage
 */
export async function ingestSource({ sourceType, source, file, threadId }) {
  const form = new FormData();
  form.append("source_type", sourceType);
  form.append("thread_id", threadId);

  if (sourceType === "pdf" && file) {
    form.append(
      "file",
      new Blob([file.buffer], { type: file.mimetype }),
      file.originalname,
    );
  } else if (source) {
    form.append("source", source);
  } else {
    throw new Error(
      "Provide either a file (pdf) or a source (url/youtube/text)",
    );
  }

  let response;
  try {
    response = await fetch(`${config.AI_BACKEND_URL}/ingest`, {
      method: "POST",
      body: form, // fetch sets the multipart boundary automatically for FormData
    });
  } catch (err) {
    throw new Error(`Could not reach AI backend: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`AI backend responded with status ${response.status}`);
  }

  return response.json(); // {success, message}
}
