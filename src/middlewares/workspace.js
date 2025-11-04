export function workspaceContext(req, res, next) {
  const ws =
    req.headers["x-workspace-id"] ||
    req.params.workspaceId ||
    req.query.workspaceId ||
    req.body.workspaceId ||
    req.user?.workspaceId ||
    null;

  if (!ws)
    return res
      .status(400)
      .json({ error: "workspaceId required (x-workspace-id header or param)" });

  req.ctx = req.ctx || {};
  req.ctx.workspaceId = String(ws);
  next();
}

// alias supaya route yang pakai workspaceGuard tetap jalan
export { workspaceContext as workspaceGuard };
