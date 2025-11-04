import svc from "./contentRelationM2m.service.js";

class ContentRelationM2mController {
  async attach(req, res) {
    try {
      const workspaceId = req.workspace?.id || req.headers["x-workspace-id"];
      const { fieldId } = req.params;
      const { fromEntryId, toEntryIds } = req.body;
      const rows = await svc.attach({ workspaceId, fieldId, fromEntryId, toEntryIds });
      res.json({ success: true, count: rows.length });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async detach(req, res) {
    try {
      const workspaceId = req.workspace?.id || req.headers["x-workspace-id"];
      const { fieldId } = req.params;
      const { fromEntryId, toEntryIds } = req.body;
      const out = await svc.detach({ workspaceId, fieldId, fromEntryId, toEntryIds });
      res.json({ success: true, removed: out.count });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async list(req, res) {
    try {
      const workspaceId = req.workspace?.id || req.headers["x-workspace-id"];
      const { fieldId, fromEntryId } = req.params;
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 20);
      const out = await svc.list({ workspaceId, fieldId, fromEntryId, page, pageSize });
      res.json(out);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
}

export default new ContentRelationM2mController();
