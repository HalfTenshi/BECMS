// src/modules/content/contentRelationM2m.service.js
import prisma from "../../config/prismaClient.js";
import m2mRepo from "./contentRelationM2m.repository.js";

function assert(cond, msg) {
  if (!cond) {
    const e = new Error(msg);
    e.status = 400;
    throw e;
  }
}

// Helper khusus untuk error yang lebih informatif di getRelationFieldOrThrow
function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}

class ContentRelationM2mService {
  /**
   * Ambil field RELATION + config M2M dan pastikan:
   * - field ada
   * - milik workspace yang benar (via contentType.workspaceId)
   * - type === "RELATION"
   * - kind === "MANY_TO_MANY"
   *
   * Pakai httpError supaya pesan error lebih jelas.
   */
  async getRelationFieldOrThrow({ workspaceId, fieldId }) {
    const field = await prisma.contentField.findUnique({
      where: { id: fieldId },
      select: {
        id: true,
        type: true,
        contentTypeId: true,
        relation: {
          select: {
            kind: true,              // ONE_TO_ONE | ONE_TO_MANY | MANY_TO_ONE | MANY_TO_MANY
            targetContentTypeId: true,
          },
        },
        contentType: {
          select: {
            workspaceId: true,       // workspace dicek dari ContentType
          },
        },
      },
    });

    if (!field) {
      httpError(404, `Relation field not found (fieldId=${fieldId})`);
    }
    if (field.contentType?.workspaceId !== workspaceId) {
      httpError(
        404,
        `Relation field not in workspace (fieldId=${fieldId}, workspaceId=${workspaceId})`,
      );
    }
    if (field.type !== "RELATION") {
      httpError(400, `Field is not RELATION type (fieldId=${fieldId})`);
    }
    if (!field.relation) {
      httpError(400, `Missing relation config for fieldId=${fieldId}`);
    }
    if (field.relation.kind !== "MANY_TO_MANY") {
      httpError(
        400,
        `Relation kind must be MANY_TO_MANY, got ${field.relation.kind} (fieldId=${fieldId})`,
      );
    }

    return field; // berisi field + relation + contentType.workspaceId
  }

  /**
   * Attach banyak target (toEntryIds) ke satu fromEntryId di field M2M.
   * - Auto-append posisi di repository (m2mRepo.attachMany).
   */
  async attach({ workspaceId, fieldId, fromEntryId, toEntryIds = [] }) {
    assert(
      workspaceId && fieldId && fromEntryId,
      "workspaceId, fieldId, fromEntryId required",
    );
    assert(Array.isArray(toEntryIds), "toEntryIds must be array");

    const field = await this.getRelationFieldOrThrow({ workspaceId, fieldId });
    const rel = field.relation;

    // Validasi from entry
    const from = await prisma.contentEntry.findUnique({
      where: { id: fromEntryId },
      select: { id: true, workspaceId: true, contentTypeId: true },
    });
    assert(from && from.workspaceId === workspaceId, "From entry not found in workspace");

    if (!toEntryIds.length) {
      return [];
    }

    // Pastikan semua target ada & punya contentType sesuai targetContentTypeId
    const targets = await prisma.contentEntry.findMany({
      where: {
        id: { in: toEntryIds },
        workspaceId,
        contentTypeId: rel.targetContentTypeId,
      },
      select: { id: true },
    });
    assert(
      targets.length === toEntryIds.length,
      "Some target entries not found / content type mismatch",
    );

    return m2mRepo.attachMany({
      workspaceId,
      relationFieldId: fieldId,
      fromEntryId,
      toEntryIds,
    });
  }

  /**
   * Detach (hapus hubungan) beberapa toEntryIds dari satu fromEntryId.
   */
  async detach({ workspaceId, fieldId, fromEntryId, toEntryIds = [] }) {
    assert(
      workspaceId && fieldId && fromEntryId,
      "workspaceId, fieldId, fromEntryId required",
    );
    assert(Array.isArray(toEntryIds), "toEntryIds must be array");

    await this.getRelationFieldOrThrow({ workspaceId, fieldId });

    return m2mRepo.detachMany({
      relationFieldId: fieldId,
      fromEntryId,
      toEntryIds,
    });
  }

  /**
   * List semua target (toEntry) terhubung ke fromEntryId di field M2M.
   */
  async list({ workspaceId, fieldId, fromEntryId, page = 1, pageSize = 20 }) {
    assert(
      workspaceId && fieldId && fromEntryId,
      "workspaceId, fieldId, fromEntryId required",
    );

    await this.getRelationFieldOrThrow({ workspaceId, fieldId });

    return m2mRepo.listRelated({
      relationFieldId: fieldId,
      fromEntryId,
      page,
      pageSize,
    });
  }

  /**
   * Reverse lookup M2M:
   * - cari semua fromEntryId yang related ke relatedEntryId via fieldId.
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
      "workspaceId, fieldId, relatedEntryId required",
    );

    await this.getRelationFieldOrThrow({ workspaceId, fieldId });

    return m2mRepo.findFromByRelated({
      relationFieldId: fieldId,
      relatedEntryId,
      page,
      pageSize,
    });
  }

  /**
   * Reorder M2M — set urutan toEntryIds jadi 0..n (position ASC).
   */
  async reorder({ workspaceId, fieldId, fromEntryId, orderedToEntryIds = [] }) {
    assert(
      workspaceId && fieldId && fromEntryId,
      "workspaceId, fieldId, fromEntryId required",
    );
    assert(Array.isArray(orderedToEntryIds), "orderedToEntryIds must be array");

    await this.getRelationFieldOrThrow({ workspaceId, fieldId });

    return m2mRepo.setOrder({
      relationFieldId: fieldId,
      fromEntryId,
      orderedToEntryIds,
    });
  }
}

export default new ContentRelationM2mService();
