// src/modules/asset/asset.service.js

import crypto from "crypto";
import assetRepo from "./asset.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

class AssetService {
  async list(opts) {
    const { workspaceId } = opts || {};
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "ASSET_WORKSPACE_ID_REQUIRED",
        resource: "ASSETS",
      });
    }

    return assetRepo.list({
      workspaceId,
      q: opts.q,
      mime: opts.mime,
      onlyImages: !!opts.onlyImages,
      tag: opts.tag,
      folder: opts.folder,
      page: opts.page,
      limit: opts.limit,
      sort: opts.sort,
    });
  }

  async get({ id, workspaceId }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "ASSET_WORKSPACE_ID_REQUIRED",
        resource: "ASSETS",
      });
    }
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "ASSET_ID_REQUIRED",
        resource: "ASSETS",
      });
    }

    const a = await assetRepo.getById(id, workspaceId);
    if (!a) {
      throw ApiError.notFound("Asset not found", {
        code: ERROR_CODES.ASSET_NOT_FOUND,
        reason: "ASSET_NOT_FOUND",
        resource: "ASSETS",
        details: { id, workspaceId },
      });
    }
    return a;
  }

  async remove({ id, workspaceId }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "ASSET_WORKSPACE_ID_REQUIRED",
        resource: "ASSETS",
      });
    }
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "ASSET_ID_REQUIRED",
        resource: "ASSETS",
      });
    }

    const existing = await assetRepo.getById(id, workspaceId);
    if (!existing) {
      throw ApiError.notFound("Asset not found", {
        code: ERROR_CODES.ASSET_NOT_FOUND,
        reason: "ASSET_NOT_FOUND",
        resource: "ASSETS",
        details: { id, workspaceId },
      });
    }

    // (opsional) hapus file fisik juga kalau mau — butuh path ke /uploads
    await assetRepo.delete(id);
    return { message: "Asset deleted" };
  }

  async update({ id, workspaceId, data }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "ASSET_WORKSPACE_ID_REQUIRED",
        resource: "ASSETS",
      });
    }
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "ASSET_ID_REQUIRED",
        resource: "ASSETS",
      });
    }

    const existing = await assetRepo.getById(id, workspaceId);
    if (!existing) {
      throw ApiError.notFound("Asset not found", {
        code: ERROR_CODES.ASSET_NOT_FOUND,
        reason: "ASSET_NOT_FOUND",
        resource: "ASSETS",
        details: { id, workspaceId },
      });
    }

    // Batasi field yang boleh diupdate (misalnya hanya metadata, bukan url/mime)
    const payload = { ...data };
    delete payload.id;
    delete payload.workspaceId;
    delete payload.createdById;
    delete payload.url;
    delete payload.mime;
    delete payload.size;
    delete payload.checksum;

    // Normalisasi tags kalau dikirim
    if (payload.tags) {
      if (typeof payload.tags === "string") {
        payload.tags = payload.tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (!Array.isArray(payload.tags)) {
        payload.tags = [];
      }
    }

    // Normalisasi folder (trim)
    if (typeof payload.folder === "string") {
      payload.folder = payload.folder.trim() || null;
    }

    return assetRepo.update(id, payload);
  }

  /**
   * Ingest buffer upload → buat 1 Asset (dipanggil dari upload.routes.js)
   * @returns record Asset
   */
  async ingestOne({ workspaceId, userId, fileMeta }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "ASSET_WORKSPACE_ID_REQUIRED",
        resource: "ASSETS",
      });
    }

    const {
      buffer,
      originalName,
      mime,
      size,
      outFilename,
      url,
      width = null,
      height = null,
      durationMs = null,
      folder = null,
      extraTags = [],
    } = fileMeta;

    const checksum = buffer ? sha256(buffer) : null;

    // Normalisasi tags
    const tags = Array.isArray(extraTags)
      ? extraTags.map((t) => String(t).trim()).filter(Boolean)
      : [];

    // Optional dedupe by checksum (kalau unique constraint terpicu)
    try {
      const rec = await assetRepo.createOne({
        workspaceId,
        createdById: userId || null,
        filename: outFilename,
        originalName: originalName || null,
        url,
        mime,
        size,
        checksum,
        width,
        height,
        durationMs,
        tags,
        folder,
      });

      return rec;
    } catch (err) {
      // Prisma unique constraint: P2002 → fallback cari by checksum
      if (checksum && err?.code === "P2002") {
        const existing = await assetRepo.findByChecksum(checksum);
        if (existing) return existing;
      }
      // Error lain biar lewat ke errorHandler (bisa 500)
      throw err;
    }
  }
}

export default new AssetService();
