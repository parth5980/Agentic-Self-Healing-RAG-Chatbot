import Thread from "../models/thread.model.js";
import Source from "../models/source.model.js";
import {
  streamAIResponse,
  ingestSource,
  listSources,
  deleteSource,
  deleteAllSources,
} from "../services/aiClient.service.js";

// GET /api/chat/thread — every thread that belongs to the logged-in user
export async function getThreads(req, res) {
  try {
    const threads = await Thread.find({ author: req.user.id }).sort({
      updatedAt: -1,
    });
    res.json(threads);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
}

// GET /api/chat/thread/:threadId
export async function getThreadById(req, res) {
  const { threadId } = req.params;

  try {
    const thread = await Thread.findOne({
      thread_id: threadId,
      author: req.user.id,
    });

    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.json(thread.messages);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch chat" });
  }
}

// DELETE /api/chat/thread/:threadId
export async function deleteThread(req, res) {
  const { threadId } = req.params;

  try {
    const deletedThread = await Thread.findOneAndDelete({
      thread_id: threadId,
      author: req.user.id,
    });

    if (!deletedThread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    await deleteAllSources({ threadId }).catch((err) =>
      console.log("Failed to clean up sources:", err),
    );

    res.status(200).json({ success: "Thread deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to delete thread" });
  }
}

// POST /api/chat/chat
// export async function sendMessage(req, res) {
//   const { threadId, message } = req.body;

//   if (!threadId || !message) {
//     return res.status(400).json({ error: "missing required fields" });
//   }

//   try {
//     let thread = await Thread.findOne({ thread_id: threadId });
//     let chatHistory = [];

//     if (!thread) {
//       thread = new Thread({
//         thread_id: threadId,
//         author: req.user.id,
//         title: message.slice(0, 60),
//         messages: [],
//       });
//     } else if (thread.author?.toString() !== req.user.id) {
//       // Someone is trying to post into a thread they don't own
//       return res
//         .status(403)
//         .json({ error: "You don't have access to this thread" });
//     } else {
//       // Snapshot the history BEFORE adding the current turn — backend-ai
//       // receives the current question separately as `message`, so it
//       // shouldn't also be the last item in chat_history.
//       chatHistory = thread.messages.map(({ role, content }) => ({
//         role,
//         content,
//       }));
//     }

//     thread.messages.push({ role: "user", content: message });

//     const assistantReply = await getAIResponse({
//       message,
//       threadId,
//       chatHistory,
//     });

//     thread.messages.push({ role: "assistant", content: assistantReply });
//     thread.updatedAt = new Date();

//     await thread.save();
//     res.json({ reply: assistantReply });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ error: "something went wrong" });
//   }
// }

// POST /api/chat/chat — now streams Server-Sent Events instead of one JSON blob
export async function sendMessage(req, res) {
  const { threadId, message } = req.body;

  if (!threadId || !message) {
    return res.status(400).json({ error: "missing required fields" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // stops nginx/other proxies buffering the stream
  res.flushHeaders();

  const send = (payload) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // If the browser tab closes/navigates away mid-answer, stop paying for
  // tokens/compute on a request nobody's listening to anymore.
  const controller = new AbortController();
  req.on("close", () => controller.abort());

  try {
    let thread = await Thread.findOne({ thread_id: threadId });
    let chatHistory = [];

    if (!thread) {
      thread = new Thread({
        thread_id: threadId,
        author: req.user.id,
        title: message.slice(0, 60),
        messages: [],
      });
    } else if (thread.author?.toString() !== req.user.id) {
      send({ type: "error", message: "You don't have access to this thread" });
      return res.end();
    } else {
      chatHistory = thread.messages.map(({ role, content }) => ({
        role,
        content,
      }));
    }

    thread.messages.push({ role: "user", content: message });

    const assistantReply = await streamAIResponse({
      message,
      threadId,
      chatHistory,
      signal: controller.signal,
      onEvent: send,
    });

    thread.messages.push({ role: "assistant", content: assistantReply });
    thread.updatedAt = new Date();
    await thread.save();

    send({ type: "done" });
  } catch (err) {
    console.log(err);
    send({ type: "error", message: "something went wrong" });
  } finally {
    if (!res.writableEnded) res.end();
  }
}

const VALID_SOURCE_TYPES = ["pdf", "url", "youtube", "text"];
// POST /api/chat/ingest
// multipart/form-data for sourceType "pdf" (with a file field), or plain
// JSON for "url" / "youtube" / "text" (with a source string). The
// upload.middleware only kicks in when the request is actually multipart,
// so both cases hit this same handler.
export async function ingest(req, res) {
  const { sourceType, source, threadId } = req.body;

  if (!threadId) {
    return res.status(400).json({ error: "threadId is required" });
  }

  if (!sourceType || !VALID_SOURCE_TYPES.includes(sourceType)) {
    return res.status(400).json({
      error: `sourceType must be one of: ${VALID_SOURCE_TYPES.join(", ")}`,
    });
  }

  if (sourceType === "pdf" && !req.file) {
    return res
      .status(400)
      .json({ error: "file is required for sourceType 'pdf'" });
  }

  if (sourceType !== "pdf" && !source) {
    return res
      .status(400)
      .json({ error: "source is required for this sourceType" });
  }

  try {
    const existingThread = await Thread.findOne({ thread_id: threadId });
    if (existingThread && existingThread.author?.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You don't have access to this thread" });
    }

    if (!existingThread) {
      existingThread = await Thread.create({
        thread_id: threadId,
        author: req.user.id,
        title: "New Chat",
        messages: [],
      });
    }

    const result = await ingestSource({
      sourceType,
      source,
      file: req.file,
      threadId,
    });

    if (!result.success) {
      // backend-ai reached the document but couldn't process it
      // (bad URL, unreadable PDF, no YouTube transcript, etc.)
      return res.status(422).json({ error: result.message });
    }

    res.json(result); // { success, message, source_id }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to ingest source" });
  }
}

// GET /api/chat/thread/:threadId/sources
export async function getThreadSources(req, res) {
  const { threadId } = req.params;
  try {
    const thread = await Thread.findOne({ thread_id: threadId });
    if (thread && thread.author?.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You don't have access to this thread" });
    }
    const result = await listSources({ threadId });
    res.json(result.documents); // [{source_id, source_type, display_name}] || []-safe
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to fetch sources" });
  }
}

// DELETE /api/chat/thread/:threadId/sources/:sourceId
export async function deleteThreadSource(req, res) {
  const { threadId, sourceId } = req.params;
  try {
    const thread = await Thread.findOne({ thread_id: threadId });
    if (thread && thread.author?.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You don't have access to this thread" });
    }
    const result = await deleteSource({ threadId, sourceId });
    if (!result.success) return res.status(404).json({ error: result.message });
    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to delete source" });
  }
}

// DELETE /api/chat/thread/:threadId/sources
export async function deleteAllThreadSources(req, res) {
  const { threadId } = req.params;
  try {
    const thread = await Thread.findOne({ thread_id: threadId });
    if (thread && thread.author?.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "You don't have access to this thread" });
    }
    const result = await deleteAllSources({ threadId });
    if (!result.success) return res.status(404).json({ error: result.message });
    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to delete sources" });
  }
}
