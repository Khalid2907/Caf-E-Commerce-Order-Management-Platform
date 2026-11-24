/**
 * COMMON GROUND — Cryptographic Password Hashing & Stateless Token Utility
 * Uses Node.js built-in `crypto` (scrypt + timingSafeEqual + HMAC-SHA256).
 */

const crypto = require("crypto");

const DEFAULT_SECRET =
  process.env.AUTH_TOKEN_SECRET ||
  "common-ground-dev-hmac-secret-change-in-production-64-bytes-key";

/**
 * Hashes a plaintext password using salted scrypt.
 * @param {string} password
 * @returns {string} format: `scrypt$<saltHex>$<hashHex>`
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash using timingSafeEqual.
 * @param {string} password
 * @param {string} storedHash
 * @returns {boolean}
 */
function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;
  const expectedBuf = Buffer.from(hashHex, "hex");
  const actualBuf = crypto.scryptSync(String(password), salt, 64);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Signs a stateless authentication token (JWT-compatible 3-part base64url structure).
 * @param {object} payload - { userId, email, role, fullName }
 * @param {number} [expiresInHours=24]
 * @returns {string}
 */
function signToken(payload, expiresInHours = 24) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url"
  );
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", DEFAULT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies a signed token and returns its decoded payload, or null if invalid/expired.
 * @param {string} token
 * @returns {object|null}
 */
function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", DEFAULT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
};
