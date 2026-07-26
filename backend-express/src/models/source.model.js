import mongoose from "mongoose";

const sourceSchema = new mongoose.Schema(
  {
    threadId: {
      type: String,
      required: true,
      index: true, // matches Thread.thread_id — same join key used everywhere else (chat, ingest)
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sourceType: {
      type: String,
      enum: ["pdf", "url", "youtube", "text"],
      required: true,
    },
    name: {
      type: String,
      required: true, // filename (pdf), page title/URL (url), video title (youtube)
    },
    size: {
      type: Number, // bytes, pdf only
    },
    ragSourceId: {
      type: String, // Backend-ai's identifier for this source in Pinecone, used to delete it.
    },
  },
  { timestamps: true }, // createdAt powers "Added today" in the modal
);

export default mongoose.model("Source", sourceSchema);
