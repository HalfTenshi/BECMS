import assetRepo from "./asset.repository.js";
import path from "path";
import crypto from "crypto";

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export default new (class AssetService {
  async list(opts) {
    return assetRepo.list(opts);
  }

  async get(id) {
    const a = await assetRepo.getById(id);
    if (!a) throw new Error("Asset not found");
    return a;
  }

  async remove({ id }) {
    // (opsional) hapus file fisik juga kalau mau — butuh path ke /uploads
    return assetRepo.delete(id);
  }

  async update({ id, data }) {
    return assetRepo.update(id, data);
  }

  /**
   * Ingest buffer upload → buat 1 Asset (dipanggil dari upload.routes.js)
   * @returns { url, id }
   */
  async ingestOne({ workspaceId, userId, fileMeta }) {
    const {
      buffer, originalName, mime, size, outFilename, url, width = null, height = null, durationMs = null, folder = null, extraTags = [],
    } = fileMeta;

    const checksum = buffer ? sha256(buffer) : null;

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
      tags: extraTags,
      folder,
    });

    return rec;
  }
})();
