// src/modules/asset/asset.service.js
import crypto from "crypto";
import assetRepo from "./asset.repository.js";

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

class AssetService {
  async list(opts) {
    const { workspaceId } = opts || {};
    if (!workspaceId) {
      throw new Error("workspaceId is required");
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
      throw new Error("workspaceId is required");
    }
    if (!id) {
      throw new Error("id is required");
    }

    const a = await assetRepo.getById(id, workspaceId);
    if (!a) {
      const e = new Error("Asset not found");
      e.status = 404;
      throw e;
    }
    return a;
  }

  async remove({ id, workspaceId }) {
    if (!workspaceId) {
      throw new Error("workspaceId is required");
    }
    if (!id) {
      throw new Error("id is required");
    }

    const existing = await assetRepo.getById(id, workspaceId);
    if (!existing) {
      const e = new Error("Asset not found");
      e.status = 404;
      throw e;
    }

    // (opsional) hapus file fisik juga kalau mau — butuh path ke /uploads
    await assetRepo.delete(id);
    return { message: "Asset deleted" };
  }

  async update({ id, workspaceId, data }) {
    if (!workspaceId) {
      throw new Error("workspaceId is required");
    }
    if (!id) {
      throw new Error("id is required");
    }

    const existing = await assetRepo.getById(id, workspaceId);
    if (!existing) {
      const e = new Error("Asset not found");
      e.status = 404;
      throw e;
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
      throw new Error("workspaceId is required");
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
      throw err;
    }
  }
}

export default new AssetService();
