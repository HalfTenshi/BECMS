import assetService from "./asset.service.js";

class AssetController {
  async list(req, res) {
    try {
      const workspaceId = req.workspace?.id || req.ctx?.workspaceId || req.headers["x-workspace-id"];
      const { q, mime, tag, folder, page, limit, sort } = req.query;
      const data = await assetService.list({
        workspaceId,
        q,
        mime,
        tag,
        folder,
        page: Number(page || 1),
        limit: Number(limit || 20),
        sort: sort || "createdAt:desc",
      });
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async detail(req, res) {
    try {
      const data = await assetService.get(req.params.id);
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }

  async update(req, res) {
    try {
      const data = await assetService.update({ id: req.params.id, data: req.body });
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async remove(req, res) {
    try {
      await assetService.remove({ id: req.params.id });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
}

export default new AssetController();
