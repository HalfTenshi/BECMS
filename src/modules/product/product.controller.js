// =========================================================
// src/modules/product/product.controller.js
// =========================================================

import productService from "./product.service.js";
import { ok, created, noContent } from "../../utils/response.js";

function resolveWorkspaceId(req) {
  return (
    req.workspaceId ||
    req.workspace?.id ||
    req.headers["x-workspace-id"] ||
    null
  );
}

class ProductController {
  /**
   * List semua product dalam satu workspace.
   */
  async getAll(req, res, next) {
    try {
      const workspaceId = resolveWorkspaceId(req);

      const products = await productService.list({
        workspaceId,
        query: req.query || {},
      });

      return ok(res, products);
    } catch (e) {
      return next(e);
    }
  }

  /**
   * Ambil satu product by id (scoped ke workspace).
   */
  async getById(req, res, next) {
    try {
      const workspaceId = resolveWorkspaceId(req);
      const { id } = req.params;

      const product = await productService.get({
        workspaceId,
        id,
      });

      return ok(res, product);
    } catch (e) {
      return next(e);
    }
  }

  /**
   * Create product baru di workspace.
   */
  async create(req, res, next) {
    try {
      const workspaceId = resolveWorkspaceId(req);
      const payload = req.body;

      const product = await productService.create({
        workspaceId,
        payload,
      });

      return created(res, product);
    } catch (e) {
      return next(e);
    }
  }

  /**
   * Update product.
   */
  async update(req, res, next) {
    try {
      const workspaceId = resolveWorkspaceId(req);
      const { id } = req.params;
      const payload = req.body;

      const product = await productService.update({
        workspaceId,
        id,
        payload,
      });

      return ok(res, product);
    } catch (e) {
      return next(e);
    }
  }

  /**
   * Delete product.
   */
  async delete(req, res, next) {
    try {
      const workspaceId = resolveWorkspaceId(req);
      const { id } = req.params;

      await productService.remove({
        workspaceId,
        id,
      });

      return noContent(res);
    } catch (e) {
      return next(e);
    }
  }
}

export default new ProductController();
