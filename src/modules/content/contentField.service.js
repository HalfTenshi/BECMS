// src/modules/content/contentField.service.js
import repo from "./contentField.repository.js";
import prisma from "../../config/prismaClient.js";

const TEXT_LIKE = ["TEXT", "RICH_TEXT"];
const ALLOWED_TYPES = [
  "TEXT",
  "RICH_TEXT",
  "NUMBER",
  "BOOLEAN",
  "DATE",
  "JSON",
  "SLUG",
  "RELATION",
  "MEDIA",
];

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

  if (!name || !apiKey || !type) {
    throw new Error("name, apiKey, and type are required");
  }

  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error(`Invalid field type: ${type}`);
  }

  // apiKey format
  const API_KEY_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  if (!API_KEY_REGEX.test(apiKey)) {
    throw new Error(
      "apiKey must start with a letter and contain only letters, numbers, or underscore"
    );
  }

  // Min/Max rules
  if (payload.minLength != null && payload.minLength < 0) {
    throw new Error("minLength must be >= 0");
  }

  if (
    payload.maxLength != null &&
    payload.minLength != null &&
    payload.maxLength < payload.minLength
  ) {
    throw new Error("maxLength cannot be less than minLength");
  }

  if (payload.minNumber != null && payload.maxNumber != null) {
    if (payload.maxNumber < payload.minNumber) {
      throw new Error("maxNumber cannot be less than minNumber");
    }
  }

  // SLUG type specific
  if (type === "SLUG" && payload.slugFrom && typeof payload.slugFrom !== "string") {
    throw new Error("slugFrom must be a field apiKey string");
  }

  // RELATION type: relation config wajib diatur di create/update
}

async function assertValidSlugFrom(contentTypeId, slugFrom) {
  if (!slugFrom) return;

  const sourceField = await prisma.contentField.findFirst({
    where: { contentTypeId, apiKey: slugFrom },
    select: { id: true, type: true },
  });

  if (!sourceField) {
    throw new Error("slugFrom references non-existing field");
  }

  if (!TEXT_LIKE.includes(sourceField.type)) {
    throw new Error("slugFrom must reference a TEXT-like field");
  }
}

async function assertValidRelation(contentTypeId, relation) {
  if (!relation) return;

  const ALLOWED_KINDS = ["MANY_TO_ONE", "ONE_TO_MANY", "MANY_TO_MANY", "ONE_TO_ONE"];

  if (!relation.kind || !ALLOWED_KINDS.includes(relation.kind)) {
    throw new Error("Invalid relation kind");
  }

  if (!relation.targetContentTypeId) {
    throw new Error("targetContentTypeId is required for relation");
  }

  const target = await prisma.contentType.findUnique({
    where: { id: relation.targetContentTypeId },
    select: { id: true },
  });

  if (!target) {
    throw new Error("targetContentTypeId not found");
  }

  // (opsional) tambahan policy, misalnya larang ONE_TO_ONE self-relasi, dll
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

    // apiKey unik dalam ContentType
    if (payload.apiKey) {
      const exists = await repo.findByApiKey(contentTypeId, payload.apiKey);
      if (exists) {
        throw new Error("apiKey already exists in this ContentType");
      }
    }

    assertValidFieldPayload(payload);
    await assertValidSlugFrom(contentTypeId, payload.slugFrom);
    await assertValidRelation(contentTypeId, payload.relation);

    const position = await repo.getNextPosition(contentTypeId);

    const created = await repo.createField({
      contentTypeId,
      name: payload.name,
      apiKey: payload.apiKey,
      type: payload.type,
      isRequired: payload.isRequired ?? false,
      isUnique: payload.isUnique ?? false,
      minLength: payload.minLength ?? null,
      maxLength: payload.maxLength ?? null,
      minNumber: payload.minNumber ?? null,
      maxNumber: payload.maxNumber ?? null,
      slugFrom: payload.slugFrom ?? null,
      config: payload.config ?? null,
      position,
    });

    if (payload.relation) {
      await repo.upsertRelationConfig(created.id, payload.relation);
    }

    return this.detail({
      contentTypeId,
      fieldId: created.id,
      workspaceId,
    });
  }

  async update({ contentTypeId, fieldId, workspaceId, payload }) {
    const ct = await repo.findCTById(contentTypeId);
    assertWorkspace(ct, workspaceId);

    const current = await repo.findById(fieldId);
    if (!current || current.contentTypeId !== contentTypeId) {
      const e = new Error("Field not found in this ContentType");
      e.status = 404;
      throw e;
    }

    if (payload.apiKey && payload.apiKey !== current.apiKey) {
      const exists = await repo.findByApiKey(contentTypeId, payload.apiKey);
      if (exists) {
        throw new Error("apiKey already exists in this ContentType");
      }
    }

    const mergedForValidation = { ...current, ...payload };
    assertValidFieldPayload(mergedForValidation);
    await assertValidSlugFrom(
      contentTypeId,
      payload.slugFrom ?? current.slugFrom
    );
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
      config: payload.config ?? current.config,
    });

    if (payload.type === "RELATION" || payload.relation) {
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
      e.status = 404;
      throw e;
    }

    // Prisma onDelete Cascade akan menghapus RelationConfig & FieldValue
    await repo.deleteField(fieldId);
    return { message: "Field deleted" };
  }

  async reorder({ contentTypeId, workspaceId, items }) {
    const ct = await repo.findCTById(contentTypeId);
    assertWorkspace(ct, workspaceId);

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("items is required and must be a non-empty array");
    }

    const ids = items.map((i) => i.id);
    const all = await prisma.contentField.findMany({
      where: { id: { in: ids } },
    });

    if (all.length !== items.length) {
      throw new Error("Some field(s) not found");
    }

    if (all.some((x) => x.contentTypeId !== contentTypeId)) {
      throw new Error("Some field(s) not in this ContentType");
    }

    await repo.bulkUpdatePositions(items);
    return { message: "Reordered" };
  }
}

export default new ContentFieldService();
