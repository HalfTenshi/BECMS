// =========================================================
// src/middlewares/auth.js
// =========================================================

import { verifyToken } from "../utils/jwt.js";
import prisma from "../config/prismaClient.js";
import { ApiError } from "../utils/ApiError.js";
import { ERROR_CODES } from "../constants/errorCodes.js";

/**
 * Authentication middleware
 *
 * - Expect header: Authorization: Bearer <token>
 * - Verifies JWT
 * - Load user dari database
 * - Set ke req.user dan req.authTokenPayload
 *
 * Contoh error (akan diformat oleh errorHandler.js):
 * 401 Unauthorized
 * {
 *   success: false,
 *   error: {
 *     status: 401,
 *     code: "AUTH_INVALID_TOKEN",
 *     reason: "AUTH_INVALID_TOKEN",
 *     detail: "Unauthorized",
 *     ...
 *   }
 * }
 */
export async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) {
      throw ApiError.unauthorized("Unauthorized", {
        code: ERROR_CODES.AUTH_MISSING_TOKEN,
        reason: "AUTH_MISSING_TOKEN",
        resource: "AUTH",
        action: "VERIFY_TOKEN",
      });
    }

    let payload;
    try {
      // payload biasanya: { userId, ... }
      payload = verifyToken(token);
    } catch (e) {
      throw ApiError.unauthorized("Unauthorized", {
        code: ERROR_CODES.AUTH_INVALID_TOKEN,
        reason: "AUTH_INVALID_TOKEN",
        resource: "AUTH",
        action: "VERIFY_TOKEN",
      });
    }

    if (!payload || !payload.userId) {
      throw ApiError.unauthorized("Unauthorized", {
        code: ERROR_CODES.AUTH_INVALID_TOKEN,
        reason: "AUTH_INVALID_PAYLOAD",
        resource: "AUTH",
        action: "VERIFY_TOKEN",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw ApiError.unauthorized("Unauthorized", {
        code: ERROR_CODES.AUTH_USER_NOT_FOUND,
        reason: "AUTH_USER_NOT_FOUND",
        resource: "USERS",
        action: "READ",
      });
    }

    // Optional: kalau kamu pakai enum AccountStatus di User
    if (user.status && user.status !== "ACTIVE") {
      throw ApiError.forbidden("Account is not active", {
        code: ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
        reason: "AUTH_ACCOUNT_INACTIVE",
        resource: "USERS",
        action: "READ",
      });
    }

    // Inject ke req untuk dipakai middleware lain / controller
    req.user = user;
    req.authTokenPayload = payload;

    return next();
  } catch (err) {
    // ApiError akan langsung diformat oleh errorHandler
    return next(err);
  }
}

// Biar kompatibel kalau ada import default
export default auth;
