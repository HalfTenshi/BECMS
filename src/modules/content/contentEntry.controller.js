// src/modules/content/contentEntry.controller.js
import contentEntryService from "./contentEntry.service.js";
import { ok, created, noContent } from "../../utils/response.js";
import { ApiError } from "../../utils/ApiError.js";

class ContentEntryController {
  // ===================== READ =====================
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

      const {
        contentTypeId,
        contentType, // apiKey
        search = "",
        isPublished,
        page = 1,
        pageSize = 20,
      } = req.query;

      const result = await contentEntryService.getAll(workspaceId, {
        contentTypeId,
        contentTypeApiKey: contentType,
        search,
        isPublished,
        page: Number(page),
        pageSize: Number(pageSize),
      });

      return ok(res, result);
    } catch (error) {
      return next(
        new ApiError(
          error.status || 500,
          error.message || "Failed to fetch content entries",
          { code: "CONTENT_ENTRY_LIST_FAILED" }
        )
      );
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const { include = "", depth = 0 } = req.query;
      const workspaceId = req.workspaceId || req.workspace?.id;

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      // Jika client meminta include=relations/depth, gunakan service khusus
      if (include) {
        const scope = req.baseUrl.includes("/api/admin/") ? "admin" : "public";
        const result = await contentEntryService.getByIdWithInclude({
          id,
          workspaceId,
          include,
          depth: Number(depth) || 0,
          scope,
        });
        return ok(res, result);
      }

      const result = await contentEntryService.getById(id, workspaceId);
      return ok(res, result);
    } catch (error) {
      return next(
        new ApiError(
          error.status || 404,
          error.message || "Entry not found",
          { code: "CONTENT_ENTRY_NOT_FOUND" }
        )
      );
    }
  }

  // ===================== WRITE =====================
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

      const payload = {
        ...req.body,
        workspaceId,
        metaDescription: req.body?.metaDescription,
        keywords: req.body?.keywords, // string atau array, dinormalisasi di service
      };

      const result = await contentEntryService.create(payload);
      return created(res, result);
    } catch (error) {
      return next(
        new ApiError(
          error.status || 400,
          error.message || "Failed to create entry",
          { code: "CONTENT_ENTRY_CREATE_FAILED" }
        )
      );
    }
  }

  async update(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const { id } = req.params;

      const payload = {
        ...req.body,
        metaDescription: req.body?.metaDescription,
        keywords: req.body?.keywords,
      };

      const result = await contentEntryService.update(id, workspaceId, payload);
      return ok(res, result);
    } catch (error) {
      return next(
        new ApiError(
          error.status || 400,
          error.message || "Failed to update entry",
          { code: "CONTENT_ENTRY_UPDATE_FAILED" }
        )
      );
    }
  }

  async delete(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const { id } = req.params;
      await contentEntryService.delete(id, workspaceId);
      return noContent(res);
    } catch (error) {
      const status = error.message === "Entry not found" ? 404 : 400;
      const code =
        error.message === "Entry not found"
          ? "CONTENT_ENTRY_NOT_FOUND"
          : "CONTENT_ENTRY_DELETE_FAILED";

      return next(new ApiError(status, error.message || "Failed to delete", { code }));
    }
  }

  async publish(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const { id } = req.params;
      const result = await contentEntryService.publish(id, workspaceId);
      return ok(res, {
        message: "Published successfully",
        result,
      });
    } catch (error) {
      const status = error.message === "Entry not found" ? 404 : 400;
      const code =
        error.message === "Entry not found"
          ? "CONTENT_ENTRY_NOT_FOUND"
          : "CONTENT_ENTRY_PUBLISH_FAILED";

      return next(new ApiError(status, error.message || "Failed to publish", { code }));
    }
  }

  // ===================== UTIL / RELATION =====================

  // Listing entries per ContentType + filter relasi M2M
  // GET /api/admin/content/:contentType/entries?fieldId=&related=&page=&pageSize=
  async listByContentType(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const { contentType } = req.params; // apiKey ContentType
      const { fieldId, related, page = 1, pageSize = 20 } = req.query;

      const result = await contentEntryService.listByContentTypeWithM2M({
        workspaceId,
        contentTypeApiKey: contentType,
        fieldId,
        related,
        page,
        pageSize,
      });

      return ok(res, result);
    } catch (error) {
      return next(
        new ApiError(
          error.status || 400,
          error.message || "Failed to list entries by contentType",
          { code: "CONTENT_ENTRY_LIST_BY_TYPE_FAILED" }
        )
      );
    }
  }

  // 🔎 Util search (public & admin)
  // GET /api/content/:contentType/search
  // GET /api/admin/content/:contentType/search
  async searchForRelation(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.workspace?.id;
      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const { contentType } = req.params;
      const {
        q = "",
        page = 1,
        pageSize = 10,
        sort = "publishedAt:desc",
      } = req.query;

      const scope = req.baseUrl.includes("/api/admin/") ? "admin" : "public";

      const out = await contentEntryService.searchForRelation({
        workspaceId,
        contentTypeApiKey: contentType,
        q,
        page,
        pageSize,
        sort,
        scope,
      });

      return ok(res, out);
    } catch (error) {
      return next(
        new ApiError(
          error.status || 400,
          error.message || "Failed to search entries for relation",
          { code: "CONTENT_ENTRY_SEARCH_FAILED" }
        )
      );
    }
  }
}

export default new ContentEntryController();
