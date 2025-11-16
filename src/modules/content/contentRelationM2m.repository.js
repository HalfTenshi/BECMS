// src/modules/content/contentRelationM2m.repository.js
import prisma from "../../config/prismaClient.js";

class ContentRelationM2mRepository {
  // ---- Position helpers -----------------------------------------------------

  // Ambil posisi berikutnya untuk (relationFieldId, fromEntryId)
  async nextPosition({ relationFieldId, fromEntryId }) {
    const last = await prisma.contentRelationM2M.findFirst({
      where: { relationFieldId, fromEntryId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  // ---- CRUD / Attach / Detach ----------------------------------------------

  /**
   * ATTACH single (M2M) dengan auto-append position.
   * - Idempotent: pakai upsert berdasarkan uniq_m2m_rel_triple.
   * - Kalau sudah ada, position lama dipertahankan (tidak diubah).
   */
  async attach({ workspaceId, relationFieldId, fromEntryId, toEntryId }) {
    const pos = await this.nextPosition({ relationFieldId, fromEntryId });

    return prisma.contentRelationM2M.upsert({
      where: {
        uniq_m2m_rel_triple: { relationFieldId, fromEntryId, toEntryId },
      },
      update: {}, // tidak ubah apa pun jika sudah ada
      create: {
        workspaceId,
        relationFieldId,
        fromEntryId,
        toEntryId,
        position: pos,
      },
    });
  }

  /**
   * ATTACH banyak sekaligus (increment posisi bertahap).
   * - Idempotent per triple.
   * - Posisi hanya dipakai ketika create baru; existing dibiarkan.
   */
  async attachMany({ workspaceId, relationFieldId, fromEntryId, toEntryIds = [] }) {
    if (!toEntryIds.length) return [];

    let pos = await this.nextPosition({ relationFieldId, fromEntryId });

    const ops = toEntryIds.map((toEntryId) =>
      prisma.contentRelationM2M.upsert({
        where: {
          uniq_m2m_rel_triple: { relationFieldId, fromEntryId, toEntryId },
        },
        update: {},
        create: {
          workspaceId,
          relationFieldId,
          fromEntryId,
          toEntryId,
          position: pos++,
        },
      }),
    );

    return prisma.$transaction(ops);
  }

  /**
   * DETACH single M2M relation.
   * - Pakai deleteMany supaya idempotent: tidak error kalau triple sudah tidak ada.
   */
  async detach({ relationFieldId, fromEntryId, toEntryId }) {
    const result = await prisma.contentRelationM2M.deleteMany({
      where: { relationFieldId, fromEntryId, toEntryId },
    });
    return { count: result.count };
  }

  async detachMany({ relationFieldId, fromEntryId, toEntryIds = [] }) {
    if (!toEntryIds.length) return { count: 0 };

    return prisma.contentRelationM2M.deleteMany({
      where: {
        relationFieldId,
        fromEntryId,
        toEntryId: { in: toEntryIds },
      },
    });
  }

  async clear({ relationFieldId, fromEntryId }) {
    return prisma.contentRelationM2M.deleteMany({
      where: { relationFieldId, fromEntryId },
    });
  }

  // ---- Listing / Pagination -------------------------------------------------

  // List "toEntryId" milik (relationFieldId, fromEntryId) dengan urutan position ASC
  async listByFrom({ relationFieldId, fromEntryId, page = 1, pageSize = 20 }) {
    const skip = (page - 1) * pageSize;

    const [rows, total] = await prisma.$transaction([
      prisma.contentRelationM2M.findMany({
        where: { relationFieldId, fromEntryId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip,
        take: pageSize,
        select: { id: true, toEntryId: true, position: true },
      }),
      prisma.contentRelationM2M.count({
        where: { relationFieldId, fromEntryId },
      }),
    ]);

    return { rows, total, page, pageSize };
  }

  // Alias kompatibel dengan versi lama (tetap ada, tapi pakai order posisi)
  async listRelated({ relationFieldId, fromEntryId, page = 1, pageSize = 20 }) {
    return this.listByFrom({ relationFieldId, fromEntryId, page, pageSize });
  }

  // Reverse lookup: cari semua "fromEntryId" yang terkait ke satu relatedEntryId
  async findFromByRelated({ relationFieldId, relatedEntryId, page = 1, pageSize = 20 }) {
    const skip = (page - 1) * pageSize;

    const [rows, total] = await prisma.$transaction([
      prisma.contentRelationM2M.findMany({
        where: { relationFieldId, toEntryId: relatedEntryId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        skip,
        take: pageSize,
        select: { fromEntryId: true, position: true },
      }),
      prisma.contentRelationM2M.count({
        where: { relationFieldId, toEntryId: relatedEntryId },
      }),
    ]);

    return { rows, total, page, pageSize };
  }

  // ---- Reorder --------------------------------------------------------------

  /**
   * Set urutan baru berdasarkan array toEntryIds (0..n).
   * Hanya akan meng-update baris yang berubah posisinya (transaction).
   */
  async setOrder({ relationFieldId, fromEntryId, orderedToEntryIds = [] }) {
    if (!Array.isArray(orderedToEntryIds)) {
      throw new Error("orderedToEntryIds must be an array");
    }

    // Ambil seluruh row untuk kombinasi ini (tanpa batasan pagination)
    const { rows } = await this.listByFrom({
      relationFieldId,
      fromEntryId,
      page: 1,
      pageSize: 999999,
    });

    const byToId = new Map(rows.map((r) => [r.toEntryId, r]));
    const ops = [];

    orderedToEntryIds.forEach((toId, idx) => {
      const row = byToId.get(toId);
      if (row && row.position !== idx) {
        ops.push(
          prisma.contentRelationM2M.update({
            where: { id: row.id },
            data: { position: idx },
          }),
        );
      }
    });

    if (ops.length) {
      await prisma.$transaction(ops);
    }

    // kembalikan state terbaru (full list, terurut)
    return this.listByFrom({
      relationFieldId,
      fromEntryId,
      page: 1,
      pageSize: 999999,
    });
  }
}

export default new ContentRelationM2mRepository();
