import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: [true, "Email is required"] },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: [true, "User is required"],
    },
    otpHash: { type: String, required: [true, "OTP hash is required"] },
    purpose: {
      type: String,
      enum: ["verify-email", "reset-password"],
      default: "verify-email",
    },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Mongo deletes the doc once expiresAt passes (the TTL sweep runs ~every 60s,
// so the code in otp.service.js also checks expiresAt itself).
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// One live code per user per purpose
otpSchema.index({ user: 1, purpose: 1 }, { unique: true });

export default mongoose.model("otps", otpSchema);
