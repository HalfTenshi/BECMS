// =========================================================
// src/modules/brand/brand.service.js
// =========================================================

import brandRepository from "./brand.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

class BrandService {
  // -----------------------------
  // Nama "baru" yang konsisten: list / get / create / update / remove
  // -----------------------------

  async list({ workspaceId }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BRAND_WORKSPACE_ID_REQUIRED",
        resource: "BRANDS",
      });
    }

    return brandRepository.findAllByWorkspace(workspaceId);
  }

  async get({ id, workspaceId }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BRAND_WORKSPACE_ID_REQUIRED",
        resource: "BRANDS",
      });
    }
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BRAND_ID_REQUIRED",
        resource: "BRANDS",
      });
    }

    const brand = await brandRepository.findByIdInWorkspace(id, workspaceId);
    if (!brand) {
      throw ApiError.notFound("Brand not found", {
        code: ERROR_CODES.BRAND_NOT_FOUND,
        reason: "BRAND_NOT_FOUND",
        resource: "BRANDS",
        details: { id, workspaceId },
      });
    }

    return brand;
  }

  async create({ workspaceId, data }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BRAND_WORKSPACE_ID_REQUIRED",
        resource: "BRANDS",
      });
    }
    if (!data?.name) {
      throw ApiError.badRequest("name is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BRAND_NAME_REQUIRED",
        resource: "BRANDS",
      });
    }

    const name = String(data.name).trim();
    if (!name) {
      throw ApiError.badRequest("name cannot be empty", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BRAND_NAME_EMPTY",
        resource: "BRANDS",
      });
    }

    const slug =
      data.slug ||
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const payload = {
      ...data,
      name,
      slug,
      workspaceId,
    };

    return brandRepository.create(payload);
  }

  async update({ id, workspaceId, data }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BRAND_WORKSPACE_ID_REQUIRED",
        resource: "BRANDS",
      });
    }
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BRAND_ID_REQUIRED",
        resource: "BRANDS",
      });
    }

    const existing = await brandRepository.findByIdInWorkspace(
      id,
      workspaceId
    );
    if (!existing) {
      throw ApiError.notFound("Brand not found", {
        code: ERROR_CODES.BRAND_NOT_FOUND,
        reason: "BRAND_NOT_FOUND",
        resource: "BRANDS",
        details: { id, workspaceId },
      });
    }

    const payload = { ...data };

    if (payload.name) {
      payload.name = String(payload.name).trim();
    }

    if (payload.name && !payload.slug) {
      payload.slug = payload.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    // Jangan izinkan ganti workspace di sini
    delete payload.workspaceId;

    return brandRepository.update(id, workspaceId, payload);
  }

  async remove({ id, workspaceId }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BRAND_WORKSPACE_ID_REQUIRED",
        resource: "BRANDS",
      });
    }
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BRAND_ID_REQUIRED",
        resource: "BRANDS",
      });
    }

    const existing = await brandRepository.findByIdInWorkspace(
      id,
      workspaceId
    );
    if (!existing) {
      throw ApiError.notFound("Brand not found", {
        code: ERROR_CODES.BRAND_NOT_FOUND,
        reason: "BRAND_NOT_FOUND",
        resource: "BRANDS",
        details: { id, workspaceId },
      });
    }

    await brandRepository.delete(id, workspaceId);
    return { message: "Brand deleted" };
  }

  // -----------------------------
  // Alias nama lama (kompatibilitas)
  // -----------------------------
  async getAll(ctx) {
    return this.list(ctx);
  }

  async getById(ctx) {
    return this.get(ctx);
  }

  async delete(ctx) {
    return this.remove(ctx);
  }
}

export default new BrandService();
