// src/modules/content/contentField.service.js

import repo from "./contentField.repository.js";
import prisma from "../../config/prismaClient.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

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
  if (!ct) {
    throw ApiError.notFound("ContentType not found", {
      code: ERROR_CODES.CONTENT_TYPE_NOT_FOUND,
      reason: "CONTENT_TYPE_NOT_FOUND",
      resource: "CONTENT_TYPES",
      details: { workspaceId },
    });
  }
  if (ct.workspaceId !== workspaceId) {
    throw ApiError.notFound("ContentType not in workspace", {
      code: ERROR_CODES.CONTENT_TYPE_NOT_FOUND,
      reason: "CONTENT_TYPE_NOT_IN_WORKSPACE",
      resource: "CONTENT_TYPES",
      details: { contentTypeId: ct.id, workspaceId },
    });
  }
}

function assertValidFieldPayload(payload) {
  const { name, apiKey, type } = payload;

  if (!name || !apiKey || !type) {
    throw ApiError.badRequest("name, apiKey, and type are required", {
      code: ERROR_CODES.VALIDATION_ERROR,
      reason: "CONTENT_FIELD_REQUIRED_FIELDS_MISSING",
      resource: "CONTENT_FIELDS",
      details: { name: !!name, apiKey: !!apiKey, type: !!type },
    });
  }

  if (!ALLOWED_TYPES.includes(type)) {
    throw ApiError.unprocessable(`Invalid field type: ${type}`, {
      code: ERROR_CODES.VALIDATION_ERROR,
      reason: "CONTENT_FIELD_INVALID_TYPE",
      resource: "CONTENT_FIELDS",
      details: { type },
    });
  }

  // apiKey format
  const API_KEY_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  if (!API_KEY_REGEX.test(apiKey)) {
    throw ApiError.unprocessable(
      "apiKey must start with a letter and contain only letters, numbers, or underscore",
      {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "CONTENT_FIELD_INVALID_API_KEY",
        resource: "CONTENT_FIELDS",
        details: { apiKey },
      }
    );
  }

  // Min/Max rules
  if (payload.minLength != null && payload.minLength < 0) {
    throw ApiError.unprocessable("minLength must be >= 0", {
      code: ERROR_CODES.VALIDATION_ERROR,
      reason: "CONTENT_FIELD_INVALID_MIN_LENGTH",
      resource: "CONTENT_FIELDS",
      details: { minLength: payload.minLength },
    });
  }

  if (
    payload.maxLength != null &&
    payload.minLength != null &&
    payload.maxLength < payload.minLength
  ) {
    throw ApiError.unprocessable("maxLength cannot be less than minLength", {
      code: ERROR_CODES.VALIDATION_ERROR,
      reason: "CONTENT_FIELD_INVALID_MAX_LENGTH",
      resource: "CONTENT_FIELDS",
      details: {
        minLength: payload.minLength,
        maxLength: payload.maxLength,
      },
    });
  }

  if (payload.minNumber != null && payload.maxNumber != null) {
    if (payload.maxNumber < payload.minNumber) {
      throw ApiError.unprocessable(
        "maxNumber cannot be less than minNumber",
        {
          code: ERROR_CODES.VALIDATION_ERROR,
          reason: "CONTENT_FIELD_INVALID_NUMBER_RANGE",
          resource: "CONTENT_FIELDS",
          details: {
            minNumber: payload.minNumber,
            maxNumber: payload.maxNumber,
          },
        }
      );
    }
  }

  // SLUG type specific
  if (type === "SLUG" && payload.slugFrom && typeof payload.slugFrom !== "string") {
    throw ApiError.unprocessable("slugFrom must be a field apiKey string", {
      code: ERROR_CODES.VALIDATION_ERROR,
      reason: "CONTENT_FIELD_INVALID_SLUG_FROM",
      resource: "CONTENT_FIELDS",
      details: { slugFrom: payload.slugFrom },
    });
  }

  // RELATION type: relation config wajib diatur di create/update (divalidasi di helper lain)
}

async function assertValidSlugFrom(contentTypeId, slugFrom) {
  if (!slugFrom) return;

  const sourceField = await prisma.contentField.findFirst({
    where: { contentTypeId, apiKey: slugFrom },
    select: { id: true, type: true },
  });

  if (!sourceField) {
    throw ApiError.unprocessable("slugFrom references non-existing field", {
      code: ERROR_CODES.VALIDATION_ERROR,
      reason: "CONTENT_FIELD_SLUG_FROM_FIELD_NOT_FOUND",
      resource: "CONTENT_FIELDS",
      details: { slugFrom },
    });
  }

  if (!TEXT_LIKE.includes(sourceField.type)) {
    throw ApiError.unprocessable(
      "slugFrom must reference a TEXT-like field",
      {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "CONTENT_FIELD_SLUG_FROM_INVALID_TYPE",
        resource: "CONTENT_FIELDS",
        details: { slugFrom, type: sourceField.type },
      }
    );
  }
}

async function assertValidRelation(contentTypeId, relation) {
  if (!relation) return;

  const ALLOWED_KINDS = ["MANY_TO_ONE", "ONE_TO_MANY", "MANY_TO_MANY", "ONE_TO_ONE"];

  if (!relation.kind || !ALLOWED_KINDS.includes(relation.kind)) {
    throw ApiError.unprocessable("Invalid relation kind", {
      code: ERROR_CODES.VALIDATION_ERROR,
      reason: "CONTENT_FIELD_INVALID_RELATION_KIND",
      resource: "CONTENT_FIELDS",
      details: { kind: relation.kind },
    });
  }

  if (!relation.targetContentTypeId) {
    throw ApiError.unprocessable(
      "targetContentTypeId is required for relation",
      {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "CONTENT_FIELD_RELATION_TARGET_REQUIRED",
        resource: "CONTENT_FIELDS",
      }
    );
  }

  const target = await prisma.contentType.findUnique({
    where: { id: relation.targetContentTypeId },
    select: { id: true },
  });

  if (!target) {
    throw ApiError.unprocessable("targetContentTypeId not found", {
      code: ERROR_CODES.VALIDATION_ERROR,
      reason: "CONTENT_FIELD_RELATION_TARGET_NOT_FOUND",
      resource: "CONTENT_FIELDS",
      details: { targetContentTypeId: relation.targetContentTypeId },
    });
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
      throw ApiError.notFound("Field not found in this ContentType", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "CONTENT_FIELD_NOT_FOUND",
        resource: "CONTENT_FIELDS",
        details: { fieldId, contentTypeId },
      });
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
        throw ApiError.unprocessable(
          "apiKey already exists in this ContentType",
          {
            code: ERROR_CODES.VALIDATION_ERROR,
            reason: "CONTENT_FIELD_API_KEY_DUPLICATE",
            resource: "CONTENT_FIELDS",
            details: { apiKey: payload.apiKey },
          }
        );
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
      throw ApiError.notFound("Field not found in this ContentType", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "CONTENT_FIELD_NOT_FOUND",
        resource: "CONTENT_FIELDS",
        details: { fieldId, contentTypeId },
      });
    }

    if (payload.apiKey && payload.apiKey !== current.apiKey) {
      const exists = await repo.findByApiKey(contentTypeId, payload.apiKey);
      if (exists) {
        throw ApiError.unprocessable(
          "apiKey already exists in this ContentType",
          {
            code: ERROR_CODES.VALIDATION_ERROR,
            reason: "CONTENT_FIELD_API_KEY_DUPLICATE",
            resource: "CONTENT_FIELDS",
            details: { apiKey: payload.apiKey },
          }
        );
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
      throw ApiError.notFound("Field not found in this ContentType", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "CONTENT_FIELD_NOT_FOUND",
        resource: "CONTENT_FIELDS",
        details: { fieldId, contentTypeId },
      });
    }

    // Prisma onDelete Cascade akan menghapus RelationConfig & FieldValue
    await repo.deleteField(fieldId);
    return { message: "Field deleted" };
  }

  async reorder({ contentTypeId, workspaceId, items }) {
    const ct = await repo.findCTById(contentTypeId);
    assertWorkspace(ct, workspaceId);

    if (!Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest(
        "items is required and must be a non-empty array",
        {
          code: ERROR_CODES.VALIDATION_ERROR,
          reason: "CONTENT_FIELD_REORDER_ITEMS_INVALID",
          resource: "CONTENT_FIELDS",
        }
      );
    }

    const ids = items.map((i) => i.id);
    const all = await prisma.contentField.findMany({
      where: { id: { in: ids } },
    });

    if (all.length !== items.length) {
      throw ApiError.unprocessable("Some field(s) not found", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "CONTENT_FIELD_REORDER_SOME_NOT_FOUND",
        resource: "CONTENT_FIELDS",
      });
    }

    if (all.some((x) => x.contentTypeId !== contentTypeId)) {
      throw ApiError.unprocessable("Some field(s) not in this ContentType", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "CONTENT_FIELD_REORDER_WRONG_CONTENT_TYPE",
        resource: "CONTENT_FIELDS",
      });
    }

    await repo.bulkUpdatePositions(items);
    return { message: "Reordered" };
  }
}

export default new ContentFieldService();
