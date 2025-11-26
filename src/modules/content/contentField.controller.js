// src/modules/content/contentField.controller.js
import service from "./contentField.service.js";
import { ok, created } from "../../utils/response.js";
import { ApiError } from "../../utils/ApiError.js";

class ContentFieldController {
  async list(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      const contentTypeId = req.params.contentTypeId;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const data = await service.list({
        contentTypeId,
        workspaceId,
      });

      // tetap bentuk { data } agar kompatibel dengan FE lama
      return ok(res, { data });
    } catch (e) {
      const status = e.status || 400;
      return next(
        new ApiError(status, e.message || "Failed to list content fields", {
          code: "CONTENT_FIELD_LIST_FAILED",
        })
      );
    }
  }

  async detail(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      const contentTypeId = req.params.contentTypeId;
      const fieldId = req.params.fieldId;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const data = await service.detail({
        contentTypeId,
        fieldId,
        workspaceId,
      });

      return ok(res, { data });
    } catch (e) {
      const status = e.status || 404;
      return next(
        new ApiError(status, e.message || "Field not found", {
          code: "CONTENT_FIELD_NOT_FOUND",
        })
      );
    }
  }

  async create(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      const contentTypeId = req.params.contentTypeId;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const data = await service.create({
        contentTypeId,
        workspaceId,
        payload: req.body,
      });

      return created(res, { data });
    } catch (e) {
      const status = e.status || 400;
      return next(
        new ApiError(status, e.message || "Failed to create content field", {
          code: "CONTENT_FIELD_CREATE_FAILED",
        })
      );
    }
  }

  async update(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      const contentTypeId = req.params.contentTypeId;
      const fieldId = req.params.fieldId;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const data = await service.update({
        contentTypeId,
        fieldId,
        workspaceId,
        payload: req.body,
      });

      return ok(res, { data });
    } catch (e) {
      const status = e.status || 400;
      return next(
        new ApiError(status, e.message || "Failed to update content field", {
          code: "CONTENT_FIELD_UPDATE_FAILED",
        })
      );
    }
  }

  async remove(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      const contentTypeId = req.params.contentTypeId;
      const fieldId = req.params.fieldId;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const data = await service.remove({
        contentTypeId,
        fieldId,
        workspaceId,
      });

      return ok(res, data);
    } catch (e) {
      const status = e.status || 400;
      return next(
        new ApiError(status, e.message || "Failed to delete content field", {
          code: "CONTENT_FIELD_DELETE_FAILED",
        })
      );
    }
  }

  async reorder(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      const contentTypeId = req.params.contentTypeId;
      const { items } = req.body;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const data = await service.reorder({
        contentTypeId,
        workspaceId,
        items,
      });

      return ok(res, data);
    } catch (e) {
      const status = e.status || 400;
      return next(
        new ApiError(status, e.message || "Failed to reorder fields", {
          code: "CONTENT_FIELD_REORDER_FAILED",
        })
      );
    }
  }
}

export default new ContentFieldController();
