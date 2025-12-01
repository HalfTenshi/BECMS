// =========================================================
// src/modules/product/product.service.js
// =========================================================

import productRepository from "./product.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

class ProductService {
  // -----------------------------
  // Nama "baru": list / get / create / update / remove
  // -----------------------------

  async list({ workspaceId }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PRODUCT_WORKSPACE_ID_REQUIRED",
        resource: "PRODUCTS",
      });
    }

    return productRepository.findAllByWorkspace(workspaceId);
  }

  async get({ id, workspaceId }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PRODUCT_WORKSPACE_ID_REQUIRED",
        resource: "PRODUCTS",
      });
    }
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PRODUCT_ID_REQUIRED",
        resource: "PRODUCTS",
      });
    }

    const product = await productRepository.findByIdInWorkspace(
      id,
      workspaceId
    );
    if (!product) {
      throw ApiError.notFound("Product not found", {
        code: ERROR_CODES.PRODUCT_NOT_FOUND,
        reason: "PRODUCT_NOT_FOUND",
        resource: "PRODUCTS",
        details: { id, workspaceId },
      });
    }

    return product;
  }

  async create({ workspaceId, data }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PRODUCT_WORKSPACE_ID_REQUIRED",
        resource: "PRODUCTS",
      });
    }
    if (!data?.name) {
      throw ApiError.badRequest("name is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PRODUCT_NAME_REQUIRED",
        resource: "PRODUCTS",
      });
    }

    const name = String(data.name).trim();
    if (!name) {
      throw ApiError.badRequest("name cannot be empty", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PRODUCT_NAME_EMPTY",
        resource: "PRODUCTS",
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

    return productRepository.create(payload);
  }

  async update({ id, workspaceId, data }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PRODUCT_WORKSPACE_ID_REQUIRED",
        resource: "PRODUCTS",
      });
    }
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PRODUCT_ID_REQUIRED",
        resource: "PRODUCTS",
      });
    }

    const existing = await productRepository.findByIdInWorkspace(
      id,
      workspaceId
    );
    if (!existing) {
      throw ApiError.notFound("Product not found", {
        code: ERROR_CODES.PRODUCT_NOT_FOUND,
        reason: "PRODUCT_NOT_FOUND",
        resource: "PRODUCTS",
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

    return productRepository.update(id, workspaceId, payload);
  }

  async remove({ id, workspaceId }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PRODUCT_WORKSPACE_ID_REQUIRED",
        resource: "PRODUCTS",
      });
    }
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PRODUCT_ID_REQUIRED",
        resource: "PRODUCTS",
      });
    }

    const existing = await productRepository.findByIdInWorkspace(
      id,
      workspaceId
    );
    if (!existing) {
      throw ApiError.notFound("Product not found", {
        code: ERROR_CODES.PRODUCT_NOT_FOUND,
        reason: "PRODUCT_NOT_FOUND",
        resource: "PRODUCTS",
        details: { id, workspaceId },
      });
    }

    await productRepository.delete(id, workspaceId);
    return { message: "Product deleted" };
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

export default new ProductService();
