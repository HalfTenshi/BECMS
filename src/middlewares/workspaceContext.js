// src/middlewares/workspaceContext.js
function workspaceContext(req, res, next) {
  const ws =
    req.headers["x-workspace-id"] ||
    req.params.workspaceId ||
    req.query.workspaceId ||
    req.body.workspaceId ||
    req.user?.workspaceId ||
    null;

  if (!ws) {
    return res
      .status(400)
      .json({ error: "workspaceId required (x-workspace-id header or param)" });
  }

  // Kompatibel dengan kode lama & baru:
  req.ctx = req.ctx || {};
  req.ctx.workspaceId = String(ws);
  req.workspace = { id: String(ws) };

  next();
}

// Alias untuk guard lama
const workspaceGuard = workspaceContext;

// ✅ Expose sebagai named export dan default export (ESM)
export { workspaceContext, workspaceGuard };
export default workspaceContext;
