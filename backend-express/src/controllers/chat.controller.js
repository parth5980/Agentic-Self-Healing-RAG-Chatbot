import Thread from "../models/thread.model.js";
import { getAIResponse } from "../services/aiClient.service.js";

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

    res.status(200).json({ success: "Thread deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to delete thread" });
  }
}

// POST /api/chat/chat
export async function sendMessage(req, res) {
  const { threadId, message } = req.body;

  if (!threadId || !message) {
    return res.status(400).json({ error: "missing required fields" });
  }

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
      // Someone is trying to post into a thread they don't own
      return res
        .status(403)
        .json({ error: "You don't have access to this thread" });
    } else {
      // Snapshot the history BEFORE adding the current turn — backend-ai
      // receives the current question separately as `message`, so it
      // shouldn't also be the last item in chat_history.
      chatHistory = thread.messages.map(({ role, content }) => ({
        role,
        content,
      }));
    }

    thread.messages.push({ role: "user", content: message });

    const assistantReply = await getAIResponse({
      message,
      threadId,
      chatHistory,
    });

    thread.messages.push({ role: "assistant", content: assistantReply });
    thread.updatedAt = new Date();

    await thread.save();
    res.json({ reply: assistantReply });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "something went wrong" });
  }
}
