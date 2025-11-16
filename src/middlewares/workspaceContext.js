// src/middlewares/workspaceContext.js
import prisma from "../config/prismaClient.js";

/**
 * Workspace context middleware
 * Sumber workspace:
 *  - Header : x-workspace-id | x-workspace-slug
 *  - Query  : workspaceId | workspaceSlug
 *  - Params : workspaceId | workspaceSlug
 *  - Body   : workspaceId | workspaceSlug
 *  - (opsional) req.user.defaultWorkspaceId
 *
 * Output:
 *  - req.ctx.workspaceId
 *  - req.workspace = { id }
 *  - req.workspaceId
 */
async function workspaceContext(req, res, next) {
  try {
    const headerId   = req.header("x-workspace-id");
    const headerSlug = req.header("x-workspace-slug");

    const queryId    = req.query?.workspaceId;
    const querySlug  = req.query?.workspaceSlug;

    const paramId    = req.params?.workspaceId;
    const paramSlug  = req.params?.workspaceSlug;

    const bodyId     = req.body?.workspaceId;
    const bodySlug   = req.body?.workspaceSlug;

    const userDefaultId = req.user?.defaultWorkspaceId || req.user?.workspaceId;

    // 1) Prioritas ID langsung
    let workspaceId =
      headerId || queryId || paramId || bodyId || userDefaultId || null;

    // 2) Kalau belum ada ID tapi ada slug → resolve
    const slug = headerSlug || querySlug || paramSlug || bodySlug || null;
    if (!workspaceId && slug) {
      const ws = await prisma.workspace.findFirst({
        where: { slug: String(slug) },
        select: { id: true },
      });
      if (!ws) {
        return res
          .status(404)
          .json({ message: "Workspace not found for given slug" });
      }
      workspaceId = ws.id;
    }

    // 3) Kalau tetap kosong → tolak request
    if (!workspaceId) {
      return res.status(400).json({
        message:
          "workspaceId required. Provide x-workspace-id header or ?workspaceId=... (or x-workspace-slug / ?workspaceSlug=...)",
      });
    }

    // 4) Set ke beberapa tempat (kompat lama & baru)
    const wsId = String(workspaceId);          // ⬅⬅⬅ INI YANG TADI KURANG

    req.ctx = req.ctx || {};
    req.ctx.workspaceId = wsId;

    req.workspace = { id: wsId };
    req.workspaceId = wsId;

    return next();
  } catch (e) {
    return next(e);
  }
}

// Alias lama
const workspaceGuard = workspaceContext;

export { workspaceContext, workspaceGuard };
export default workspaceContext;
