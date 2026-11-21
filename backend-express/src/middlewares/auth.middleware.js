import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import config from "../config/config.js";
import sessionModel from "../models/session.model.js";

/** True only if the token's session exists, belongs to the user, and isn't revoked. */
export async function isSessionActive(decoded) {
  if (!decoded?.sessionId || !mongoose.isValidObjectId(decoded.sessionId)) {
    return false;
  }
  const session = await sessionModel
    .findOne({ _id: decoded.sessionId, user: decoded.id, revoked: false })
    .select("_id")
    .lean();
  return !!session;
}

/**
 * Protects a route by requiring a valid access token.
 *
 * Expects: Authorization: Bearer <accessToken>
 * On success: attaches req.user = { id, sessionId } and calls next()
 * On failure: responds 401 (never calls next())
 *
 * Use this on any router that should only be reachable by a logged-in user:
 *   chatRouter.use(requireAuth);
 */
export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Access token not found" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }

  try {
    if (!(await isSessionActive(decoded))) {
      return res.status(401).json({ message: "Session expired or revoked" });
    }
  } catch (err) {
    // A DB error must not become a 401, or the frontend would loop on refresh
    return next(err);
  }

  req.user = { id: decoded.id, sessionId: decoded.sessionId };
  next();
}