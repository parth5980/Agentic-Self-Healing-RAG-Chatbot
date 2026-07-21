import { Router } from "express";
import * as chatController from "../controllers/chat.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import Thread from "../models/thread.model.js";
import upload from "../middlewares/upload.middleware.js";

const chatRouter = Router();

// Every route below requires a valid access token (req.user is set by requireAuth)
chatRouter.use(requireAuth);

/**
 * GET /api/chat/thread
 */
chatRouter.get("/thread", chatController.getThreads);

/**
 * GET /api/chat/thread/:threadId
 */
chatRouter.get("/thread/:threadId", chatController.getThreadById);

/**
 * DELETE /api/chat/thread/:threadId
 */
chatRouter.delete("/thread/:threadId", chatController.deleteThread);

/**
 * POST /api/chat/chat
 */
chatRouter.post("/chat", chatController.sendMessage);

/**
 * POST /api/chat/ingest
 * multipart/form-data with a "file" field when sourceType is "pdf",
 * otherwise plain JSON with { sourceType, source }.
 */
chatRouter.post("/ingest", upload.single("file"), chatController.ingest);

export default chatRouter;

// chatRouter.post("/test", async(req, res) => {
//     try {
//         const thread = new Thread({
//             author : req.user.id,
//             thread_id: "sampleid",
//             title: "Testing New Thread"
//         });

//         const response = await thread.save();
//         res.send(response);
//     } catch(err) {
//         console.log(err);
//         res.status(500).json({error: "Failed to save in DB"});
//     }
// });
