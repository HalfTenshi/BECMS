// src/modules/asset/asset.controller.js
import assetService from "./asset.service.js";

class AssetController {
  async list(req, res) {
    try {
      const workspaceId =
        req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];

      if (!workspaceId) {
        return res
          .status(400)
          .json({ message: "workspaceId is required", code: "WORKSPACE_REQUIRED" });
      }

      const { q, mime, tag, folder, page, limit, sort, onlyImages } = req.query;

      const data = await assetService.list({
        workspaceId,
        q,
        mime,
        tag,
        folder,
        page: Number(page || 1),
        limit: Number(limit || 20),
        sort: sort || "createdAt:desc",
        onlyImages:
          typeof onlyImages === "string"
            ? onlyImages.toLowerCase() === "true"
            : !!onlyImages,
      });

      return res.json({
        success: true,
        ...data,
      });
    } catch (e) {
      return res
        .status(e.status || 400)
        .json({ message: e.message || "Failed to list assets" });
    }
  }

  async detail(req, res) {
    try {
      const workspaceId =
        req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];

      if (!workspaceId) {
        return res
          .status(400)
          .json({ message: "workspaceId is required", code: "WORKSPACE_REQUIRED" });
      }

      const data = await assetService.get({
        id: req.params.id,
        workspaceId,
      });

      return res.json({ success: true, data });
    } catch (e) {
      return res
        .status(e.status || 404)
        .json({ message: e.message || "Asset not found" });
    }
  }

  async update(req, res) {
    try {
      const workspaceId =
        req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];

      if (!workspaceId) {
        return res
          .status(400)
          .json({ message: "workspaceId is required", code: "WORKSPACE_REQUIRED" });
      }

      const data = await assetService.update({
        id: req.params.id,
        workspaceId,
        data: req.body || {},
      });

      return res.json({ success: true, data });
    } catch (e) {
      return res
        .status(e.status || 400)
        .json({ message: e.message || "Failed to update asset" });
    }
  }

  async remove(req, res) {
    try {
      const workspaceId =
        req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];

      if (!workspaceId) {
        return res
          .status(400)
          .json({ message: "workspaceId is required", code: "WORKSPACE_REQUIRED" });
      }

      await assetService.remove({
        id: req.params.id,
        workspaceId,
      });

      return res.json({ success: true, message: "Asset deleted" });
    } catch (e) {
      return res
        .status(e.status || 400)
        .json({ message: e.message || "Failed to delete asset" });
    }
  }
}

export default new AssetController();
