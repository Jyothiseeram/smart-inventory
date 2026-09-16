import crypto from "node:crypto";

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = "sha512";

/**
 * Generates a salted PBKDF2 hash for a password.
 * Format: "pbkdf2$<salt>$<hash>"
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST)
    .toString("hex");
  return `pbkdf2$${salt}$${hash}`;
}

/**
 * Verifies a password against a stored hash.
 * Supports:
 * 1. "pbkdf2$<salt>$<hash>" (modern salted standard)
 * 2. legacy 64-char raw sha256 hex (for backwards compatibility with existing test seeds)
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) {
    return false;
  }

  if (storedHash.startsWith("pbkdf2$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 3) {
      return false;
    }
    const [, salt, originalHash] = parts;
    if (!salt || !originalHash) {
      return false;
    }
    const computedHash = crypto
      .pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST)
      .toString("hex");

    const originalBuf = Buffer.from(originalHash, "hex");
    const computedBuf = Buffer.from(computedHash, "hex");
    if (originalBuf.length !== computedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(originalBuf, computedBuf);
  }

  // Legacy SHA-256 fallback (used by initial tests)
  const legacyHash = crypto.createHash("sha256").update(password).digest("hex");
  const legacyBuf = Buffer.from(legacyHash, "hex");
  const storedBuf = Buffer.from(storedHash, "hex");
  if (legacyBuf.length === storedBuf.length) {
    return crypto.timingSafeEqual(legacyBuf, storedBuf);
  }

  return false;
}
