// src/modules/content/contentType.controller.js
import contentTypeService from "./contentType.service.js";
import { ok, created, noContent } from "../../utils/response.js";
import { ApiError } from "../../utils/ApiError.js";

class ContentTypeController {
  async getAll(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const result = await contentTypeService.getAll(workspaceId);
      return ok(res, result);
    } catch (error) {
      return next(
        new ApiError(
          500,
          error.message || "Failed to fetch content types",
          { code: "CONTENT_TYPE_LIST_FAILED" }
        )
      );
    }
  }

  async getById(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      const { id } = req.params;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const result = await contentTypeService.getById(id, workspaceId);
      return ok(res, result);
    } catch (error) {
      return next(
        new ApiError(404, error.message || "Content type not found", {
          code: "CONTENT_TYPE_NOT_FOUND",
        })
      );
    }
  }

  async create(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const result = await contentTypeService.create(req.body, workspaceId);
      return created(res, result);
    } catch (error) {
      return next(
        new ApiError(400, error.message || "Failed to create content type", {
          code: "CONTENT_TYPE_CREATE_FAILED",
        })
      );
    }
  }

  async update(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      const { id } = req.params;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const result = await contentTypeService.update(
        id,
        req.body,
        workspaceId
      );
      return ok(res, result);
    } catch (error) {
      return next(
        new ApiError(400, error.message || "Failed to update content type", {
          code: "CONTENT_TYPE_UPDATE_FAILED",
        })
      );
    }
  }

  async delete(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      const { id } = req.params;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      await contentTypeService.delete(id, workspaceId);
      return noContent(res);
    } catch (error) {
      // kalau type not found → 404, kalau masih ada entry → 400
      const msg = error.message || "Failed to delete content type";
      const code =
        msg.includes("not found") ?
          "CONTENT_TYPE_NOT_FOUND" :
          "CONTENT_TYPE_DELETE_FAILED";

      const status = msg.includes("not found") ? 404 : 400;

      return next(
        new ApiError(status, msg, {
          code,
        })
      );
    }
  }
}

export default new ContentTypeController();
