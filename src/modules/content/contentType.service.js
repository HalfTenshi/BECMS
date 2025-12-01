// src/modules/content/contentType.service.js

import prisma from "../../config/prismaClient.js";
import contentTypeRepository from "./contentType.repository.js";
import contentEntryRepository from "./contentEntry.repository.js";
import {
  enforcePlanLimit,
  PLAN_LIMIT_ACTIONS,
} from "../../services/planLimit.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

const API_KEY_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

class ContentTypeService {
  async getAll(workspaceId) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.WORKSPACE_REQUIRED,
        reason: "CONTENT_TYPE_WORKSPACE_ID_REQUIRED",
        resource: "CONTENT_TYPES",
      });
    }
    return contentTypeRepository.findAllByWorkspace(workspaceId);
  }

  async getById(id, workspaceId) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.WORKSPACE_REQUIRED,
        reason: "CONTENT_TYPE_WORKSPACE_ID_REQUIRED",
        resource: "CONTENT_TYPES",
      });
    }
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "CONTENT_TYPE_ID_REQUIRED",
        resource: "CONTENT_TYPES",
      });
    }

    const ct = await contentTypeRepository.findByIdInWorkspace(
      id,
      workspaceId
    );
    if (!ct) {
      throw ApiError.notFound("Content type not found", {
        code: ERROR_CODES.CONTENT_TYPE_NOT_FOUND,
        reason: "CONTENT_TYPE_NOT_FOUND",
        resource: "CONTENT_TYPES",
        details: { id, workspaceId },
      });
    }
    return ct;
  }

  async create(data, workspaceId) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.WORKSPACE_REQUIRED,
        reason: "CONTENT_TYPE_WORKSPACE_ID_REQUIRED",
        resource: "CONTENT_TYPES",
      });
    }

    const name = data.name?.trim();
    const apiKey = data.apiKey?.trim();

    if (!name || !apiKey) {
      throw ApiError.badRequest("name and apiKey are required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "CONTENT_TYPE_REQUIRED_FIELDS_MISSING",
        resource: "CONTENT_TYPES",
        details: { name: !!name, apiKey: !!apiKey },
      });
    }

    if (!API_KEY_REGEX.test(apiKey)) {
      throw ApiError.unprocessable(
        "apiKey must start with a letter and contain only letters, numbers, or underscore",
        {
          code: ERROR_CODES.VALIDATION_ERROR,
          reason: "CONTENT_TYPE_INVALID_API_KEY",
          resource: "CONTENT_TYPES",
          details: { apiKey },
        }
      );
    }

    // Pastikan apiKey unik di workspace ini
    const existing = await prisma.contentType.findFirst({
      where: { workspaceId, apiKey },
    });
    if (existing) {
      throw ApiError.unprocessable(
        "apiKey already exists in this workspace",
        {
          code: ERROR_CODES.VALIDATION_ERROR,
          reason: "CONTENT_TYPE_API_KEY_DUPLICATE",
          resource: "CONTENT_TYPES",
          details: { apiKey },
        }
      );
    }

    // 🔐 Enforce plan limit: maxContentTypes
    await enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_CONTENT_TYPE);

    return contentTypeRepository.create({
      ...data,
      name,
      apiKey,
      workspaceId,
    });
  }

  async update(id, data, workspaceId) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.WORKSPACE_REQUIRED,
        reason: "CONTENT_TYPE_WORKSPACE_ID_REQUIRED",
        resource: "CONTENT_TYPES",
      });
    }
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "CONTENT_TYPE_ID_REQUIRED",
        resource: "CONTENT_TYPES",
      });
    }

    // Pastikan content type milik workspace ini
    const ct = await contentTypeRepository.findByIdInWorkspace(
      id,
      workspaceId
    );
    if (!ct) {
      throw ApiError.notFound("Content type not found", {
        code: ERROR_CODES.CONTENT_TYPE_NOT_FOUND,
        reason: "CONTENT_TYPE_NOT_FOUND",
        resource: "CONTENT_TYPES",
        details: { id, workspaceId },
      });
    }

    const payload = { ...data };

    if (payload.name) {
      payload.name = String(payload.name).trim();
    }

    if (payload.apiKey) {
      payload.apiKey = String(payload.apiKey).trim();
      if (!API_KEY_REGEX.test(payload.apiKey)) {
        throw ApiError.unprocessable(
          "apiKey must start with a letter and contain only letters, numbers, or underscore",
          {
            code: ERROR_CODES.VALIDATION_ERROR,
            reason: "CONTENT_TYPE_INVALID_API_KEY",
            resource: "CONTENT_TYPES",
            details: { apiKey: payload.apiKey },
          }
        );
      }

      // Cek unik apiKey kalau diubah
      if (payload.apiKey !== ct.apiKey) {
        const existing = await prisma.contentType.findFirst({
          where: {
            workspaceId,
            apiKey: payload.apiKey,
            NOT: { id },
          },
        });
        if (existing) {
          throw ApiError.unprocessable(
            "apiKey already exists in this workspace",
            {
              code: ERROR_CODES.VALIDATION_ERROR,
              reason: "CONTENT_TYPE_API_KEY_DUPLICATE",
              resource: "CONTENT_TYPES",
              details: { apiKey: payload.apiKey },
            }
          );
        }
      }
    }

    // 🔐 SEO CONFIG ENFORCEMENT
    // Jika seoEnabled diubah dari true → false, kita perlu auto-clean SEO fields
    const willDisableSeo =
      typeof payload.seoEnabled === "boolean" &&
      payload.seoEnabled === false &&
      ct.seoEnabled === true;

    // Update content type dulu
    const updated = await contentTypeRepository.update(id, payload);

    // Jika baru saja mematikan SEO untuk model ini:
    // - bersihkan semua SEO fields di entries terkait (multi-tenant aware)
    if (willDisableSeo) {
      await contentEntryRepository.clearSeoFieldsByContentType(
        workspaceId,
        id
      );
    }

    return updated;
  }

  async delete(id, workspaceId) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.WORKSPACE_REQUIRED,
        reason: "CONTENT_TYPE_WORKSPACE_ID_REQUIRED",
        resource: "CONTENT_TYPES",
      });
    }
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "CONTENT_TYPE_ID_REQUIRED",
        resource: "CONTENT_TYPES",
      });
    }

    // Pastikan content type milik workspace ini
    const ct = await contentTypeRepository.findByIdInWorkspace(
      id,
      workspaceId
    );
    if (!ct) {
      throw ApiError.notFound("Content type not found", {
        code: ERROR_CODES.CONTENT_TYPE_NOT_FOUND,
        reason: "CONTENT_TYPE_NOT_FOUND",
        resource: "CONTENT_TYPES",
        details: { id, workspaceId },
      });
    }

    // Guard: jangan hapus kalau masih ada entries
    const entryCount = await prisma.contentEntry.count({
      where: { contentTypeId: id, workspaceId },
    });

    if (entryCount > 0) {
      throw ApiError.unprocessable(
        "Cannot delete content type that still has content entries",
        {
          code: ERROR_CODES.VALIDATION_ERROR,
          reason: "CONTENT_TYPE_HAS_ENTRIES",
          resource: "CONTENT_TYPES",
          details: { entryCount },
        }
      );
    }

    await contentTypeRepository.delete(id);
    return { message: "Content type deleted" };
  }
}

export default new ContentTypeService();
