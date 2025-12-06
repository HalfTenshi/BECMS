// =========================================================
// src/modules/brand/brand.controller.js
// =========================================================

import brandService from "./brand.service.js";
import { ok, created, noContent } from "../../utils/response.js";

function resolveWorkspaceId(req) {
  return (
    req.workspaceId ||
    req.workspace?.id ||
    req.headers["x-workspace-id"] ||
    null
  );
}

class BrandController {
  /**
   * List semua brand dalam satu workspace.
   */
  async getAll(req, res, next) {
    try {
      const workspaceId = resolveWorkspaceId(req);

      const brands = await brandService.list({
        workspaceId,
        query: req.query || {},
      });

      return ok(res, brands);
    } catch (e) {
      return next(e);
    }
  }

  /**
   * Ambil satu brand by id (scoped ke workspace).
   */
  async getById(req, res, next) {
    try {
      const workspaceId = resolveWorkspaceId(req);
      const { id } = req.params;

      const brand = await brandService.get({
        workspaceId,
        id,
      });

      return ok(res, brand);
    } catch (e) {
      return next(e);
    }
  }

  /**
   * Create brand baru di workspace.
   */
  async create(req, res, next) {
    try {
      const workspaceId = resolveWorkspaceId(req);
      const payload = req.body;

      const brand = await brandService.create({
        workspaceId,
        payload,
      });

      return created(res, brand);
    } catch (e) {
      return next(e);
    }
  }

  /**
   * Update brand.
   */
  async update(req, res, next) {
    try {
      const workspaceId = resolveWorkspaceId(req);
      const { id } = req.params;
      const payload = req.body;

      const brand = await brandService.update({
        workspaceId,
        id,
        payload,
      });

      return ok(res, brand);
    } catch (e) {
      return next(e);
    }
  }

  /**
   * Delete brand.
   */
  async delete(req, res, next) {
    try {
      const workspaceId = resolveWorkspaceId(req);
      const { id } = req.params;

      await brandService.remove({
        workspaceId,
        id,
      });

      return noContent(res);
    } catch (e) {
      return next(e);
    }
  }
}

export default new BrandController();
