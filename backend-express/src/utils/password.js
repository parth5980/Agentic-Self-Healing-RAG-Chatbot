import bcrypt from "bcrypt";
import crypto from "crypto";

const ROUNDS = 12;
const LEGACY_SHA256 = /^[a-f0-9]{64}$/i;

export function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

/**
 * Returns { valid, needsRehash }.
 * - bcrypt hash  -> verified with bcrypt.compare
 * - legacy SHA-256 hex -> verified the old way (constant-time), flagged for rehash
 */
export async function verifyPassword(plain, stored) {
  if (LEGACY_SHA256.test(stored)) {
    const legacy = crypto.createHash("sha256").update(plain).digest();
    const storedBuf = Buffer.from(stored, "hex");
    const valid =
      legacy.length === storedBuf.length &&
      crypto.timingSafeEqual(legacy, storedBuf);
    return { valid, needsRehash: valid };
  }
  const valid = await bcrypt.compare(plain, stored);
  return { valid, needsRehash: false };
}