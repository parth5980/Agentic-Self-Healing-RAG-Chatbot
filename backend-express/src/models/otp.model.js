import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: [true, "User is required"],
    },
    otpHash: {
      type: String,
      required: [true, "OTP hash is required"],
    },
    purpose: {
      type: String,
      enum: ["verify-email", "reset-password"],
      default: "verify-email",
    },
  },
  {
    timestamps: true,
  },
);

const otpModel = mongoose.model("otps", otpSchema);

export default otpModel;
