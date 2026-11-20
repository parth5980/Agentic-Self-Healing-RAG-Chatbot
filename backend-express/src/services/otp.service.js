import crypto from "crypto";
import config from "../config/config.js";
import otpModel from "../models/otp.model.js";
import { generateOtp } from "../utils/utils.js";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;

// Keyed HMAC bound to the email: a leaked DB can't be reversed with a
// 1,000,000-entry lookup table the way plain SHA-256 of a 6-digit code can.
function hashOtp(email, otp) {
  return crypto
    .createHmac("sha256", config.JWT_SECRET)
    .update(`${email}:${otp}`)
    .digest("hex");
}

/** Creates (or replaces) the user's code for this purpose; returns the plain code to email. */
export async function createOtp({ email, user, purpose }) {
  const otp = generateOtp();
  await otpModel.findOneAndUpdate(
    { user, purpose },
    {
      $set: {
        email,
        otpHash: hashOtp(email, otp),
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    },
    { upsert: true },
  );
  return otp;
}

/** Returns { ok: true, userId } and consumes the code, or { ok: false }. */
export async function verifyOtp({ email, otp, purpose }) {
  // Reject objects like { $ne: null } and malformed codes outright
  if (
    typeof email !== "string" ||
    typeof otp !== "string" ||
    !/^\d{6}$/.test(otp)
  ) {
    return { ok: false };
  }

  // Count the attempt BEFORE comparing, atomically, so parallel
  // requests can't slip extra guesses past the limit.
  const doc = await otpModel.findOneAndUpdate(
    { email, purpose },
    { $inc: { attempts: 1 } },
    { new: true },
  );
  if (!doc) return { ok: false };

  if (
    !doc.expiresAt ||
    doc.expiresAt < new Date() ||
    doc.attempts > MAX_OTP_ATTEMPTS
  ) {
    await otpModel.deleteOne({ _id: doc._id });
    return { ok: false };
  }

  const expected = Buffer.from(doc.otpHash, "hex");
  const actual = Buffer.from(hashOtp(email, otp), "hex");
  const match =
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual);

  if (!match) {
    if (doc.attempts >= MAX_OTP_ATTEMPTS) {
      await otpModel.deleteOne({ _id: doc._id }); // 5 wrong tries -> burn the code
    }
    return { ok: false };
  }

  // Single use: only one concurrent request can win this delete
  const consumed = await otpModel.findOneAndDelete({ _id: doc._id });
  if (!consumed) return { ok: false };

  return { ok: true, userId: doc.user };
}
