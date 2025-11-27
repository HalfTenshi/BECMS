// src/middlewares/auth.js
// Middleware autentikasi JWT (industry-standard clean version)

import { verifyToken } from "../utils/jwt.js";
import prisma from "../config/prismaClient.js";

/**
 * Auth middleware
 * - Validasi Bearer token
 * - Decode JWT -> req.user
 * - Load user ringkas dari database
 * - Validasi status ACTIVE
 */
export const auth = async (req, res, next) => {
  try {
    // --- Ambil token dari header ---
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = header.replace("Bearer ", "").trim();
    if (!token) {
      return res.status(401).json({ error: "Token not provided" });
    }

    // --- Verify & decode token ---
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // decoded: { userId, workspaceId?, iat, exp }
    const userId = decoded.userId;
    const workspaceId = decoded.workspaceId || null;

    if (!userId) {
      return res.status(401).json({ error: "Token payload missing userId" });
    }

    // Inject ke req.user
    req.user = { id: userId, workspaceId };

    // --- Load user profile minimal ---
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        pictureUrl: true,
      },
    });

    if (!profile) {
      return res.status(401).json({ error: "User not found" });
    }

    if (profile.status !== "ACTIVE") {
      return res.status(403).json({ error: "Account not active" });
    }

    req.user.profile = profile;

    // --- Sukses ---
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ error: "Authentication failed" });
  }
};
