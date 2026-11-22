import config from "../config/config.js";

const sameSite = ["strict", "lax", "none"].includes(config.COOKIE_SAMESITE)
  ? config.COOKIE_SAMESITE
  : "strict";

const secure = config.NODE_ENV === "production" || sameSite === "none";

const base = { httpOnly: true, secure, sameSite };

export const refreshCookieOptions = { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 };
export const clearCookieOptions = base;