/**
 * COMMON GROUND — Authentication & Role-Based Access Control (RBAC) Middleware
 */

const { verifyToken } = require("../utils/crypto");

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, pair) => {
    const idx = pair.indexOf("=");
    if (idx > -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      acc[key] = decodeURIComponent(val);
    }
    return acc;
  }, {});
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.cg_auth_token) {
    return cookies.cg_auth_token;
  }
  return null;
}

/**
 * Requires a valid signed authentication token.
 */
function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required. Please sign in.",
      },
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Session expired or invalid token. Please sign in again.",
      },
    });
  }

  req.user = decoded;
  next();
}

/**
 * Enforces that the authenticated user has one of the permitted roles.
 * @param  {...string} allowedRoles
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Insufficient permissions. Required role: ${allowedRoles.join(" or ")}.`,
        },
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireRole,
  extractToken,
};
