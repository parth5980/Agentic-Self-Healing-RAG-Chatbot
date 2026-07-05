import mongoose from "mongoose";
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const ThreadSchema = new Schema({
  author: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  thread_id: {
    type: String,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    default: "New Chat",
  },
  messages: [MessageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Thread = mongoose.model("Thread", ThreadSchema);

export default Thread;
