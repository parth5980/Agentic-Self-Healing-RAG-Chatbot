import config from "../config/config.js";

const sameSite = ["strict", "lax", "none"].includes(config.COOKIE_SAMESITE)
  ? config.COOKIE_SAMESITE
  : "strict";

// SameSite=None is rejected by browsers unless Secure is set.
// Plain-http localhost can't use Secure on every browser, so only force it in prod.
const secure = config.NODE_ENV === "production" || sameSite === "none";

const base = { httpOnly: true, secure, sameSite };

export const refreshCookieOptions = {
  ...base,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Must match the attributes used when the cookie was set, otherwise the
// browser ignores the clearing Set-Cookie.
export const clearCookieOptions = base;
