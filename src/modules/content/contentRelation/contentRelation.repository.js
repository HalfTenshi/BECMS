// src/modules/content/contentRelation/contentRelation.repository.js
import prisma from "../../../config/prismaClient.js";

class ContentRelationRepository {
  // List semua relation (untuk kebutuhan admin/debug)
  async findAll() {
    return prisma.contentRelation.findMany({
      include: { field: true, from: true, to: true },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  // List relasi milik satu field & satu fromEntryId (sudah terurut)
  async findByFromField({ fieldId, fromEntryId }) {
    return prisma.contentRelation.findMany({
      where: { fieldId, fromEntryId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, toEntryId: true, position: true },
    });
  }

  // Create "mentah" (pakai ketika ingin set position manual dari luar)
  async create(data) {
    return prisma.contentRelation.create({ data });
  }

  async delete(id) {
    return prisma.contentRelation.delete({ where: { id } });
  }

  // === Reorder & Position Helpers ===

  // Ambil posisi berikutnya (append di akhir)
  async nextPosition({ fieldId, fromEntryId }) {
    const last = await prisma.contentRelation.findFirst({
      where: { fieldId, fromEntryId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  // Attach dengan auto-append position (non-M2M)
  async attach({ workspaceId, fieldId, fromEntryId, toEntryId }) {
    const position = await this.nextPosition({ fieldId, fromEntryId });
    return prisma.contentRelation.create({
      data: { workspaceId, fieldId, fromEntryId, toEntryId, position },
    });
  }

  /**
   * Set urutan baru berdasarkan array toEntryIds (0..n)
   * Hanya yang berubah posisinya yang akan diupdate (transaction).
   */
  async setOrder({ fieldId, fromEntryId, orderedToEntryIds = [] }) {
    if (!Array.isArray(orderedToEntryIds)) {
      throw new Error("orderedToEntryIds must be an array");
    }

    // Ambil existing rows agar tahu id & posisi sekarang
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
          })
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
   *  - rows: [{ fromEntryId, position }, ...]
   *  - total, page, pageSize
   */
  async findFromByRelated({ fieldId, relatedEntryId, page = 1, pageSize = 20 }) {
    const skip = (page - 1) * pageSize;

    const [rows, total] = await prisma.$transaction([
      prisma.contentRelation.findMany({
        where: { fieldId, toEntryId: relatedEntryId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip,
        take: pageSize,
        select: { fromEntryId: true, position: true },
      }),
      prisma.contentRelation.count({
        where: { fieldId, toEntryId: relatedEntryId },
      }),
    ]);

    return { rows, total, page, pageSize };
  }
}

export default new ContentRelationRepository();
