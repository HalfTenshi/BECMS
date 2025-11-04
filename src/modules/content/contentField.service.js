import repo from "./contentField.repository.js";
import prisma from "../../config/prismaClient.js";

const TEXT_LIKE = ["TEXT", "RICH_TEXT"];

function assertWorkspace(ct, workspaceId) {
  if (!ct || ct.workspaceId !== workspaceId) {
    const msg = !ct ? "ContentType not found" : "ContentType not in workspace";
    const e = new Error(msg);
    e.status = 404;
    throw e;
  }
}

function assertValidFieldPayload(payload) {
  const { name, apiKey, type } = payload;
  if (!name || !apiKey || !type) throw new Error("name, apiKey, type are required");

  // Optional bounds guards
  if (payload.minLength && payload.minLength < 0) throw new Error("minLength must be >= 0");
  if (payload.maxLength && payload.maxLength < 0) throw new Error("maxLength must be >= 0");
  if (payload.minNumber && payload.maxNumber && payload.minNumber > payload.maxNumber) {
    throw new Error("minNumber cannot be greater than maxNumber");
  }
}

async function assertValidSlugFrom(contentTypeId, slugFrom) {
  if (!slugFrom) return;
  const src = await prisma.contentField.findFirst({
    where: { contentTypeId, apiKey: slugFrom },
  });
  if (!src) throw new Error("slugFrom points to non-existing field apiKey");
  if (!TEXT_LIKE.includes(src.type)) throw new Error("slugFrom must reference TEXT or RICH_TEXT field");
}

async function assertValidRelation(contentTypeId, relation) {
  if (!relation) return;
  const target = await prisma.contentType.findUnique({ where: { id: relation.targetContentTypeId } });
  if (!target) throw new Error("targetContentTypeId not found");
  // (opsional) cegah self-relasi tertentu—sesuaikan kebijakan kamu
  // if (target.id === contentTypeId && relation.kind === "ONE_TO_ONE") ...
}

class ContentFieldService {
  async list({ contentTypeId, workspaceId }) {
    const ct = await repo.findCTById(contentTypeId);
    assertWorkspace(ct, workspaceId);
    return repo.listByCT(contentTypeId);
  }

  async detail({ contentTypeId, fieldId, workspaceId }) {
    const ct = await repo.findCTById(contentTypeId);
    assertWorkspace(ct, workspaceId);

    const f = await repo.findById(fieldId);
    if (!f || f.contentTypeId !== contentTypeId) {
      const e = new Error("Field not found in this ContentType");
      e.status = 404;
      throw e;
    }
    return f;
  }

  async create({ contentTypeId, workspaceId, payload }) {
    const ct = await repo.findCTById(contentTypeId);
    assertWorkspace(ct, workspaceId);

    assertValidFieldPayload(payload);
    // unik per CT
    const exists = await repo.findByApiKey(contentTypeId, payload.apiKey);
    if (exists) throw new Error("apiKey already exists in this ContentType");

    await assertValidSlugFrom(contentTypeId, payload.slugFrom);
    await assertValidRelation(contentTypeId, payload.relation);

    // posisi default = max(position)+1
    const last = await prisma.contentField.findFirst({
      where: { contentTypeId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;

    const created = await repo.createField({
      contentTypeId,
      name: payload.name,
      apiKey: payload.apiKey,
      type: payload.type,
      isRequired: !!payload.isRequired,
      isUnique: !!payload.isUnique,
      position,
      minLength: payload.minLength ?? null,
      maxLength: payload.maxLength ?? null,
      minNumber: payload.minNumber ?? null,
      maxNumber: payload.maxNumber ?? null,
      slugFrom: payload.slugFrom ?? null,
    });

    if (payload.type === "RELATION" && payload.relation) {
      await repo.upsertRelationConfig(created.id, payload.relation);
    }

    return this.detail({ contentTypeId, fieldId: created.id, workspaceId });
  }

  async update({ contentTypeId, fieldId, workspaceId, payload }) {
    const ct = await repo.findCTById(contentTypeId);
    assertWorkspace(ct, workspaceId);

    const current = await repo.findById(fieldId);
    if (!current || current.contentTypeId !== contentTypeId) {
      const e = new Error("Field not found in this ContentType");
      e.status = 404; throw e;
    }

    if (payload.apiKey && payload.apiKey !== current.apiKey) {
      const exists = await repo.findByApiKey(contentTypeId, payload.apiKey);
      if (exists) throw new Error("apiKey already exists in this ContentType");
    }

    assertValidFieldPayload({ ...current, ...payload });
    await assertValidSlugFrom(contentTypeId, payload.slugFrom ?? current.slugFrom);
    await assertValidRelation(contentTypeId, payload.relation);

    const updated = await repo.updateField(fieldId, {
      name: payload.name ?? current.name,
      apiKey: payload.apiKey ?? current.apiKey,
      type: payload.type ?? current.type,
      isRequired: payload.isRequired ?? current.isRequired,
      isUnique: payload.isUnique ?? current.isUnique,
      minLength: payload.minLength ?? current.minLength,
      maxLength: payload.maxLength ?? current.maxLength,
      minNumber: payload.minNumber ?? current.minNumber,
      maxNumber: payload.maxNumber ?? current.maxNumber,
      slugFrom: payload.slugFrom ?? current.slugFrom,
    });

    // relation
    if ((payload.type ?? current.type) === "RELATION") {
      if (payload.relation) {
        await repo.upsertRelationConfig(fieldId, payload.relation);
      }
    } else if (current.relation) {
      await repo.deleteRelationConfig(fieldId);
    }

    return updated;
  }

  async remove({ contentTypeId, fieldId, workspaceId }) {
    const ct = await repo.findCTById(contentTypeId);
    assertWorkspace(ct, workspaceId);

    const current = await repo.findById(fieldId);
    if (!current || current.contentTypeId !== contentTypeId) {
      const e = new Error("Field not found in this ContentType");
      e.status = 404; throw e;
    }

    // Prisma onDelete Cascade akan menghapus RelationConfig & FieldValue
    await repo.deleteField(fieldId);
    return { message: "Field deleted" };
  }

  async reorder({ contentTypeId, workspaceId, items }) {
    // items: [{ id, position }]
    const ct = await repo.findCTById(contentTypeId);
    assertWorkspace(ct, workspaceId);

    // guard: semua id milik CT ini
    const ids = items.map(i => i.id);
    const all = await prisma.contentField.findMany({ where: { id: { in: ids } } });
    if (all.some(x => x.contentTypeId !== contentTypeId)) {
      throw new Error("Some field(s) not in this ContentType");
    }

    await repo.bulkUpdatePositions(items);
    return { message: "Reordered" };
  }
}

export default new ContentFieldService();
