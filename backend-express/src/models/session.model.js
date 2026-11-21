import mongoose, { model } from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: [true, "User is required"],
    },
    refreshTokenHash: {
      type: String,
      required: [true, "Refresh token hash is required"],
    },
    prevRefreshTokenHash: { type: String, default: null },
    rotatedAt: { type: Date, default: null },
    ip: {
      type: String,
      required: [true, "IP address is required"],
    },
    userAgent: {
      type: String,
      required: [true, "User agent is required"],
    },
    revoked: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  },
  {
    timestamps: true,
  },
);

sessionSchema.index({ refreshTokenHash: 1 });
sessionSchema.index({ prevRefreshTokenHash: 1 }, { sparse: true });

const sessionModel = mongoose.model("sessions", sessionSchema);

export default sessionModel;
