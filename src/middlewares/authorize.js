import prisma from "../config/prismaClient.js";

export function authorize(requiredAction, requiredModule) {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
      const workspaceId = req.ctx?.workspaceId;
      if (!workspaceId) return res.status(400).json({ error: "workspaceId missing" });

      const [ws, membership] = await Promise.all([
        prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, ownerId: true } }),
        prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
          select: { roleId: true },
        }),
      ]);
      if (!ws) return res.status(404).json({ error: "Workspace not found" });
      if (ws.ownerId === req.user.id) return next();
      if (!membership?.roleId) return res.status(403).json({ error: "Forbidden" });

      const has = await prisma.rolePermission.findFirst({
        where: {
          roleId: membership.roleId,
          permission: { workspaceId, module: requiredModule, action: requiredAction },
        },
        select: { id: true },
      });
      if (!has) return res.status(403).json({ error: "Forbidden" });
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  };
}
