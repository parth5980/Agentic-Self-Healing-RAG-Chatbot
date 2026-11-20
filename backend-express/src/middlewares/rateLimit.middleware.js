import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const base = { standardHeaders: "draft-7", legacyHeaders: false };
const tooMany = (message) => (req, res) => res.status(429).json({ message });

// Whole /api/auth router. Generous, because refresh-token and get-me
// run on every page load.
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 100,
  handler: tooMany("Too many requests. Please try again later."),
});

// Guessing targets: login, verify-email, update-password
export const guessLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  handler: tooMany("Too many attempts. Please try again in 15 minutes."),
});

// Routes that send an email (register, resend-otp, forgot-password): per IP...
export const sendCodeIpLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  handler: tooMany("Too many code requests. Please try again later."),
});

// ...and per target email, so a botnet can't farm fresh attempt counters
// for one victim by repeatedly requesting new codes.
export const sendCodeEmailLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 3,
  keyGenerator: (req) =>
    typeof req.body?.email === "string"
      ? `email:${req.body.email.toLowerCase()}`
      : ipKeyGenerator(req.ip),
  handler: tooMany("Too many code requests for this email. Try again later."),
});
