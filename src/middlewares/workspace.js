// src/middlewares/workspace.js
import prisma from "../config/prismaClient.js";

/**
 * Workspace context middleware (PUBLIC & PROTECTED friendly)
 *
 * Cara memberi tahu workspace yang diakses (pilih salah satu):
 *  1) Header :  x-workspace-id  |  x-workspace-slug
 *  2) Query  :  ?workspaceId=.. |  ?workspaceSlug=..
 *  3) Params :  /.../:workspaceId  |  /.../:workspaceSlug
 *  4) Body   :  { workspaceId }  |  { workspaceSlug }
 *  5) (Opsional) req.user.defaultWorkspaceId || req.user.workspaceId  ← jika route memakai auth
 *
 * Output:
 *  - req.ctx.workspaceId  (String)
 *  - req.workspace = { id: <String> }  (kompat dengan kode lama)
 */
async function workspaceContext(req, res, next) {
  try {
    // Kumpulkan kandidat ID/Slug dari berbagai lokasi
    const headerId   = req.header?.("x-workspace-id")   || req.headers?.["x-workspace-id"];
    const headerSlug = req.header?.("x-workspace-slug") || req.headers?.["x-workspace-slug"];

    const queryId    = req.query?.workspaceId;
    const querySlug  = req.query?.workspaceSlug;

    const paramId    = req.params?.workspaceId;
    const paramSlug  = req.params?.workspaceSlug;

    const bodyId     = req.body?.workspaceId;
    const bodySlug   = req.body?.workspaceSlug;

    // Fallback opsional dari user (jika route protected)
    const userDefaultId = req.user?.defaultWorkspaceId || req.user?.workspaceId;

    // Prioritas: ID langsung
    let workspaceId =
      headerId || queryId || paramId || bodyId || userDefaultId || null;

    // Jika belum ada ID tetapi ada slug → resolve slug → id via DB
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

    // Jika tetap tidak ada identifier → kembalikan pesan yang jelas
    if (!workspaceId) {
      return res.status(400).json({
        message:
          "workspaceId required. Provide x-workspace-id header or ?workspaceId=... (or x-workspace-slug / ?workspaceSlug=...)",
      });
    }

    // Set context (kompatibel dengan kode lama & baru)
    req.ctx = req.ctx || {};
    req.ctx.workspaceId = String(workspaceId);
    req.workspace = { id: String(workspaceId) };

    return next();
  } catch (e) {
    return next(e);
  }
}

// Alias untuk guard lama
const workspaceGuard = workspaceContext;

// ✅ Expose sebagai named export dan default export (ESM)
export { workspaceContext, workspaceGuard };
export default workspaceContext;
