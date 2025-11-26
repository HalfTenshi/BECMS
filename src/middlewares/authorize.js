// src/middlewares/authorize.js
import prisma from "../config/prismaClient.js";
import { ApiError } from "../utils/ApiError.js";

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
        return next(
          new ApiError(401, "Authentication required", {
            code: "AUTH_REQUIRED",
          })
        );
      }

      // (Opsional) blokir status user tertentu
      if (user.status && ["SUSPENDED", "DEACTIVATED"].includes(user.status)) {
        return next(
          new ApiError(403, "Account is not active", {
            code: "ACCOUNT_INACTIVE",
          })
        );
      }

      // 2) Ambil workspaceId dari beberapa sumber
      const workspaceId =
        req.workspace?.id ||
        req.ctx?.workspaceId ||
        req.headers["x-workspace-id"];

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
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

      if (!ws) {
        return next(
          new ApiError(404, "Workspace not found", {
            code: "WORKSPACE_NOT_FOUND",
          })
        );
      }

      // 5) Owner bypass
      if (ws.ownerId === user.id) {
        req._permCache.set(cacheKey, true);
        return next();
      }

      // 6) Harus punya role di workspace
      if (!membership?.roleId) {
        return next(
          new ApiError(403, "You do not have permission to access this workspace", {
            code: "FORBIDDEN_NO_ROLE",
          })
        );
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
        return next(
          new ApiError(403, "You do not have permission to access this resource", {
            code: "FORBIDDEN",
          })
        );
      }

      // 8) Simpan cache sukses dan lanjut
      req._permCache.set(cacheKey, true);
      return next();
    } catch (err) {
      console.error("authorize() error:", err);

      return next(
        new ApiError(500, "Internal Server Error", {
          code: "INTERNAL_SERVER_ERROR",
        })
      );
    }
  };
}
