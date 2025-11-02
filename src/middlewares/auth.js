import { verifyToken } from "../utils/jwt.js";
import prisma from "../config/prismaClient.js";

export async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const decoded = verifyToken(token);
    // decoded: { userId, workspaceId? , iat, exp }
    req.user = { id: decoded.userId, workspaceId: decoded.workspaceId || null };

    // (opsional) muat user ringkas untuk penggunaan downstream
    req.user.profile = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, status: true, pictureUrl: true },
    });

    if (!req.user.profile) return res.status(401).json({ error: "Invalid user" });
    if (req.user.profile.status !== "ACTIVE") return res.status(403).json({ error: "Account not active" });

    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
