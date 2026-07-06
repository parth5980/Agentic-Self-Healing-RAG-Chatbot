import jwt from "jsonwebtoken";
import config from "../config/config.js";

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
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: "Access token not found" });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = { id: decoded.id, sessionId: decoded.sessionId };
    next();
  } catch (err) {
    // Covers both an invalid signature and an expired token (jwt.verify
    // throws TokenExpiredError after 15 minutes) — the frontend should
    // treat any 401 here as "call /api/auth/refresh-token, then retry".
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
}
