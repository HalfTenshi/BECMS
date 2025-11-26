// src/modules/content/contentRelationM2m.controller.js
import svc from "./contentRelationM2m.service.js";
import { ok } from "../../utils/response.js";
import { ApiError } from "../../utils/ApiError.js";

class ContentRelationM2mController {
  async attach(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];
      const { fieldId } = req.params;
      const { fromEntryId, toEntryIds } = req.body;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const rows = await svc.attach({ workspaceId, fieldId, fromEntryId, toEntryIds });
      return ok(res, { success: true, count: rows.length });
    } catch (e) {
      return next(
        new ApiError(e.status || 400, e.message || "Failed to attach M2M relations", {
          code: "CONTENT_RELATION_M2M_ATTACH_FAILED",
        })
      );
    }
  }

  async detach(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];
      const { fieldId } = req.params;
      const { fromEntryId, toEntryIds } = req.body;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const out = await svc.detach({ workspaceId, fieldId, fromEntryId, toEntryIds });
      return ok(res, { success: true, removed: out.count });
    } catch (e) {
      return next(
        new ApiError(e.status || 400, e.message || "Failed to detach M2M relations", {
          code: "CONTENT_RELATION_M2M_DETACH_FAILED",
        })
      );
    }
  }

  async list(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];
      const { fieldId, fromEntryId } = req.params;
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 20);

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const out = await svc.list({ workspaceId, fieldId, fromEntryId, page, pageSize });
      return ok(res, out);
    } catch (e) {
      return next(
        new ApiError(e.status || 400, e.message || "Failed to list M2M relations", {
          code: "CONTENT_RELATION_M2M_LIST_FAILED",
        })
      );
    }
  }
}

export default new ContentRelationM2mController();
