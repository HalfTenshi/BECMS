// src/modules/content/contentRelation/contentRelation.service.js
import prisma from "../../../config/prismaClient.js";
import contentRelationRepository from "./contentRelation.repository.js";

function assert(cond, msg) {
  if (!cond) {
    const e = new Error(msg);
    e.status = 400;
    throw e;
  }
}

/**
 * Enforcement kardinalitas relasi non-M2M.
 *
 * Behaviour:
 *  - ONE_TO_ONE
 *      - Satu fromEntry hanya boleh 0/1 target.
 *      - Satu toEntry hanya boleh 0/1 source.
 *      - Kalau sudah ada relasi lain yang bentrok, relasi lama akan DIHAPUS,
 *        lalu relasi baru boleh dibuat (efek: "pindah pasangan").
 *
 *  - MANY_TO_ONE
 *      - Banyak fromEntry boleh menunjuk ke satu toEntry.
 *      - Satu fromEntry hanya boleh 0/1 target untuk field tersebut.
 *      - Kalau sudah ada target lain, relasi lama dihapus → diganti yang baru.
 *
 *  - ONE_TO_MANY
 *      - Satu fromEntry boleh punya banyak toEntry.
 *      - Satu toEntry hanya boleh punya satu fromEntry untuk field tersebut.
 *      - Kalau toEntry sudah terhubung ke fromEntry lain, relasi lama dihapus
 *        lalu dipindah ke fromEntry baru.
 *
 *  - MANY_TO_MANY → tidak di-enforce di sini (pakai ContentRelationM2M).
 *
 * Return:
 *  - existingRow (jika relasi persis sama sudah ada → idempotent).
 *  - null → kalau aman lanjut create relasi baru.
 */
async function enforceCardinalityBeforeAttach({
  workspaceId,
  fieldId,
  fromEntryId,
  toEntryId,
  kind,
}) {
  if (!kind || kind === "MANY_TO_MANY") {
    // M2M pakai tabel lain, di-handle terpisah
    return null;
  }

  // ONE_TO_ONE
  if (kind === "ONE_TO_ONE") {
    const [byFrom, byTo] = await Promise.all([
      prisma.contentRelation.findMany({
        where: { workspaceId, fieldId, fromEntryId },
      }),
      prisma.contentRelation.findMany({
        where: { workspaceId, fieldId, toEntryId },
      }),
    ]);

    const same = byFrom.find((r) => r.toEntryId === toEntryId);
    if (same) return same;

    const toDelete = new Set();
    byFrom.forEach((r) => toDelete.add(r.id));
    byTo.forEach((r) => toDelete.add(r.id));

    if (toDelete.size) {
      await prisma.contentRelation.deleteMany({
        where: { id: { in: Array.from(toDelete) } },
      });
    }

    return null;
  }

  // MANY_TO_ONE: banyak from → satu to, tapi from hanya boleh punya 1 to
  if (kind === "MANY_TO_ONE") {
    const existing = await prisma.contentRelation.findMany({
      where: { workspaceId, fieldId, fromEntryId },
    });

    const same = existing.find((r) => r.toEntryId === toEntryId);
    if (same) return same;

    if (existing.length) {
      await prisma.contentRelation.deleteMany({
        where: { id: { in: existing.map((r) => r.id) } },
      });
    }
    return null;
  }

  // ONE_TO_MANY: satu from → banyak to, tapi to hanya boleh punya satu from
  if (kind === "ONE_TO_MANY") {
    const existing = await prisma.contentRelation.findMany({
      where: { workspaceId, fieldId, toEntryId },
    });

    const same = existing.find((r) => r.fromEntryId === fromEntryId);
    if (same) return same;

    if (existing.length) {
      await prisma.contentRelation.deleteMany({
        where: { id: { in: existing.map((r) => r.id) } },
      });
    }
    return null;
  }

  // fallback: tidak ada enforcement tambahan
  return null;
}

class ContentRelationService {
  // Admin/debug
  async getAll() {
    return contentRelationRepository.findAll();
  }

  // Create "raw" (kalau butuh manual set position dari luar)
  async create(data) {
    assert(
      data?.workspaceId && data?.fieldId && data?.fromEntryId && data?.toEntryId,
      "workspaceId, fieldId, fromEntryId, and toEntryId required"
    );
    return contentRelationRepository.create(data);
  }

  async delete(id) {
    assert(id, "id required");
    return contentRelationRepository.delete(id);
  }

  /**
   * Append satu relasi O2O/O2M/M2O ke akhir urutan (auto position)
   * + enforcement kardinalitas berdasarkan RelationKind.
   */
  async append({ workspaceId, fieldId, fromEntryId, toEntryId }) {
    assert(
      workspaceId && fieldId && fromEntryId && toEntryId,
      "workspaceId, fieldId, fromEntryId, toEntryId required"
    );

    // 1) Validasi field RELATION + relation config
    const field = await prisma.contentField.findUnique({
      where: { id: fieldId },
      select: {
        id: true,
        type: true,
        contentTypeId: true,
        workspaceId: true,
        relation: {
          select: {
            kind: true,
            targetContentTypeId: true,
          },
        },
      },
    });

    assert(field && field.workspaceId === workspaceId, "Relation field not found in workspace");
    assert(field.type === "RELATION", "Field is not RELATION type");
    assert(field.relation?.targetContentTypeId, "Missing relation targetContentTypeId");

    const kind = field.relation.kind;

    // 2) Validasi from entry
    const from = await prisma.contentEntry.findUnique({
      where: { id: fromEntryId },
      select: { id: true, workspaceId: true, contentTypeId: true },
    });
    assert(from && from.workspaceId === workspaceId, "From entry not found in workspace");

    // 3) Validasi to entry (harus CT target)
    const to = await prisma.contentEntry.findFirst({
      where: {
        id: toEntryId,
        workspaceId,
        contentTypeId: field.relation.targetContentTypeId,
      },
      select: { id: true },
    });
    assert(!!to, "Target entry not found / content type mismatch");

    // 4) Enforcement kardinalitas
    const existingRow = await enforceCardinalityBeforeAttach({
      workspaceId,
      fieldId,
      fromEntryId,
      toEntryId,
      kind,
    });

    // Kalau relasi persis sama sudah ada → balikin yang lama (idempotent)
    if (existingRow) {
      return existingRow;
    }

    // 5) Append dengan position otomatis (fungsi di repository)
    return contentRelationRepository.attach({
      workspaceId,
      fieldId,
      fromEntryId,
      toEntryId,
    });
  }

  /**
   * Reorder urutan relasi (ONE_TO_MANY, atau fallback multi lainnya).
   * orderedToEntryIds: array toEntryId berurutan 0..n
   */
  async reorder({ fieldId, fromEntryId, orderedToEntryIds = [] }) {
    assert(fieldId && fromEntryId, "fieldId & fromEntryId required");
    assert(Array.isArray(orderedToEntryIds), "orderedToEntryIds must be array");
    return contentRelationRepository.setOrder({ fieldId, fromEntryId, orderedToEntryIds });
  }

  // List relasi milik fromEntryId + fieldId (sudah terurut by position)
  async list({ fieldId, fromEntryId }) {
    assert(fieldId && fromEntryId, "fieldId & fromEntryId required");
    return contentRelationRepository.findByFromField({ fieldId, fromEntryId });
  }

  /**
   * POIN 4: Reverse lookup "filter/list by related" NON-M2M
   * Contoh: "cari semua A (from) yang related ke B (relatedEntryId)"
   *
   * Params:
   *  - workspaceId
   *  - fieldId
   *  - relatedEntryId
   *  - page, pageSize
   */
  async filterFromByRelated({
    workspaceId,
    fieldId,
    relatedEntryId,
    page = 1,
    pageSize = 20,
  }) {
    assert(
      workspaceId && fieldId && relatedEntryId,
      "workspaceId, fieldId, relatedEntryId required"
    );

    // Validasi field RELATION & pastikan BUKAN MANY_TO_MANY
    const field = await prisma.contentField.findUnique({
      where: { id: fieldId },
      select: {
        id: true,
        type: true,
        workspaceId: true,
        relation: { select: { kind: true } },
      },
    });

    assert(field && field.workspaceId === workspaceId, "Relation field not found in workspace");
    assert(field.type === "RELATION", "Field is not RELATION type");
    assert(field.relation, "Missing relation config");
    assert(field.relation.kind !== "MANY_TO_MANY", "Use M2M service for MANY_TO_MANY");

    return contentRelationRepository.findFromByRelated({
      fieldId,
      relatedEntryId,
      page,
      pageSize,
    });
  }
}

export default new ContentRelationService();
