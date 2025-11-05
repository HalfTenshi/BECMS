import prisma from "../config/prismaClient.js";

/**
 * authorize(requiredAction, requiredModule)
 * authorize([ [action1, module1], [action2, module2], ... ])
 *
 * - Mendukung wildcard "ALL" pada action/module (di DB Permission).
 * - Owner workspace auto-approve.
 * - Cache result per request untuk mengurangi query.
 */
export function authorize(requiredActionOrPairs, requiredModule) {
  // Normalisasi input: jadi array of pairs [[action, module], ...]
  const pairs = Array.isArray(requiredActionOrPairs)
    ? requiredActionOrPairs
    : [[requiredActionOrPairs, requiredModule]];

  return async (req, res, next) => {
    try {
      // 1) Cek user
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      // (Opsional) blokir status user tertentu
      if (user.status && ["SUSPENDED", "DEACTIVATED"].includes(user.status)) {
        return res.status(403).json({ error: "Account is not active" });
      }

      // 2) Ambil workspaceId dari beberapa sumber
      const workspaceId =
        req.workspace?.id ||
        req.ctx?.workspaceId ||
        req.headers["x-workspace-id"];

      if (!workspaceId) {
        return res.status(400).json({ error: "workspaceId missing" });
      }

      // 3) Cache per request (hindari query ganda)
      req._permCache = req._permCache || new Map();
      const cacheKey = JSON.stringify({ uid: user.id, ws: workspaceId, pairs });
      if (req._permCache.has(cacheKey)) {
        return next();
      }

      // 4) Ambil workspace & membership
      const [ws, membership] = await Promise.all([
        prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { id: true, ownerId: true },
        }),
        prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: user.id } },
          select: { roleId: true },
        }),
      ]);

      if (!ws) return res.status(404).json({ error: "Workspace not found" });

      // 5) Owner bypass
      if (ws.ownerId === user.id) {
        req._permCache.set(cacheKey, true);
        return next();
      }

      // 6) Harus punya role di workspace
      if (!membership?.roleId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // 7) Build OR-query untuk semua pasangan + wildcard
      //    Permission match jika:
      //    - module === requiredModule ATAU module === "ALL"
      //    - action === requiredAction ATAU action === "ALL"
      const orBlocks = pairs.map(([act, mod]) => ({
        roleId: membership.roleId,
        permission: {
          workspaceId,
          AND: [
            { OR: [{ module: mod }, { module: "ALL" }] },
            { OR: [{ action: act }, { action: "ALL" }] },
          ],
        },
      }));

      const has = await prisma.rolePermission.findFirst({
        where: { OR: orBlocks },
        select: { id: true },
      });

      if (!has) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // 8) Simpan cache sukses dan lanjut
      req._permCache.set(cacheKey, true);
      return next();
    } catch (err) {
      // Log internal bila perlu: console.error(err)
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };
}
