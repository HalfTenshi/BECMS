// src/modules/content/contentRelation/contentRelation.repository.js
import prisma from "../../../config/prismaClient.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ERROR_CODES } from "../../../constants/errorCodes.js";

class ContentRelationRepository {
  /**
   * List semua relation (untuk kebutuhan admin/debug).
   */
  async findAll() {
    return prisma.contentRelation.findMany({
      include: {
        field: true,
        from: true,
        to: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  /**
   * List relasi milik satu field & satu fromEntryId (sudah terurut by position).
   * Dipakai untuk listing & sesudah reorder.
   */
  async findByFromField({ fieldId, fromEntryId }) {
    return prisma.contentRelation.findMany({
      where: { fieldId, fromEntryId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        toEntryId: true,
        position: true,
      },
    });
  }

  /**
   * Create "mentah" (pakai ketika ingin set position manual dari luar).
   */
  async create(data) {
    return prisma.contentRelation.create({ data });
  }

  /**
   * Hapus satu relation berdasarkan id.
   *
   * ❗ Pakai deleteMany supaya IDEMPOTENT:
   *  - Kalau id ada → terhapus.
   *  - Kalau id sudah tidak ada → tidak error.
   */
  async delete(id) {
    await prisma.contentRelation.deleteMany({
      where: { id },
    });
    return { id };
  }

  // === Reorder & Position Helpers ===

  /**
   * Ambil posisi berikutnya (append di akhir) untuk kombinasi fieldId + fromEntryId.
   */
  async nextPosition({ fieldId, fromEntryId }) {
    const last = await prisma.contentRelation.findFirst({
      where: { fieldId, fromEntryId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    // kalau belum ada, mulai dari 0
    return (last?.position ?? -1) + 1;
  }

  /**
   * Attach dengan auto-append position (non-M2M).
   * - workspaceId dipakai untuk integritas multi-tenant di level DB.
   */
  async attach({ workspaceId, fieldId, fromEntryId, toEntryId }) {
    const position = await this.nextPosition({ fieldId, fromEntryId });

    return prisma.contentRelation.create({
      data: {
        workspaceId,
        fieldId,
        fromEntryId,
        toEntryId,
        position,
      },
    });
  }

  /**
   * Set urutan baru berdasarkan array toEntryIds (0..n).
   *
   * Hanya rows yang posisi-nya BERUBAH yang akan di-update (hemat query).
   * Dikembalikan list terbaru yang sudah terurut.
   */
  async setOrder({ fieldId, fromEntryId, orderedToEntryIds = [] }) {
    if (!Array.isArray(orderedToEntryIds)) {
      throw ApiError.badRequest("orderedToEntryIds must be an array", {
        code: ERROR_CODES.VALIDATION_ERROR,
        resource: "CONTENT_RELATIONS",
        details: {
          fieldId,
          fromEntryId,
          receivedType: typeof orderedToEntryIds,
        },
      });
    }

    // Ambil existing rows agar tahu id & posisi sekarang (sudah terurut)
    const rows = await this.findByFromField({ fieldId, fromEntryId });
    const byToId = new Map(rows.map((r) => [r.toEntryId, r]));

    const ops = [];
    orderedToEntryIds.forEach((toId, idx) => {
      const row = byToId.get(toId);
      if (row && row.position !== idx) {
        ops.push(
          prisma.contentRelation.update({
            where: { id: row.id },
            data: { position: idx },
          }),
        );
      }
    });

    if (ops.length) {
      await prisma.$transaction(ops);
    }

    // Kembalikan list terbaru (sudah urut)
    return this.findByFromField({ fieldId, fromEntryId });
  }

  /**
   * Reverse lookup (POIN 4):
   *  - fieldId         : field RELATION
   *  - relatedEntryId  : toEntryId yang dicari
   *
   * Hasil:
   *  - rows: [{ fromEntryId, position }, ...] (sudah terurut)
   *  - total, page, pageSize
   */
  async findFromByRelated({ fieldId, relatedEntryId, page = 1, pageSize = 20 }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(1, Math.min(Number(pageSize) || 20, 100));
    const skip = (safePage - 1) * safePageSize;

    const [rows, total] = await prisma.$transaction([
      prisma.contentRelation.findMany({
        where: { fieldId, toEntryId: relatedEntryId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip,
        take: safePageSize,
        select: {
          fromEntryId: true,
          position: true,
        },
      }),
      prisma.contentRelation.count({
        where: { fieldId, toEntryId: relatedEntryId },
      }),
    ]);

    return {
      rows,
      total,
      page: safePage,
      pageSize: safePageSize,
    };
  }
}

export default new ContentRelationRepository();
