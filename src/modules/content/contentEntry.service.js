// src/modules/content/contentEntry.service.js
import contentEntryRepository, {
  findManyWithM2mRelated,
} from "./contentEntry.repository.js";
import prisma from "../../config/prismaClient.js";
import { generateSlug } from "../../utils/slugGenerator.js";
import { enforceOnPayload } from "./entry.validation.js";
import { recomputeDenormForTargetChange } from "../../services/denorm.service.js";
import {
  normalizeSeoFields,
  MAX_SEO_TITLE_LENGTH,
  MAX_META_DESCRIPTION_LENGTH,
} from "../../utils/seoUtils.js";
import {
  enforcePlanLimit,
  PLAN_LIMIT_ACTIONS,
} from "../../services/planLimit.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

/**
 * Validasi panjang seoTitle & metaDescription.
 * Requirement:
 *  - seoTitle > MAX_SEO_TITLE_LENGTH → 422 + SEO_TITLE_TOO_LONG
 *  - metaDescription > MAX_META_DESCRIPTION_LENGTH → 422 + SEO_DESCRIPTION_TOO_LONG
 */
function validateSeoLengths({ seoTitle, metaDescription }) {
  if (typeof seoTitle === "string") {
    const len = seoTitle.trim().length;
    if (len > MAX_SEO_TITLE_LENGTH) {
      throw ApiError.unprocessable(
        `seoTitle must be at most ${MAX_SEO_TITLE_LENGTH} characters`,
        {
          code: ERROR_CODES.SEO_TITLE_TOO_LONG,
          reason: "SEO_VALIDATION_FAILED",
          resource: "CONTENT_ENTRY_SEO",
          details: {
            field: "seoTitle",
            max: MAX_SEO_TITLE_LENGTH,
            actual: len,
          },
        }
      );
    }
  }

  if (typeof metaDescription === "string") {
    const len = metaDescription.trim().length;
    if (len > MAX_META_DESCRIPTION_LENGTH) {
      throw ApiError.unprocessable(
        `metaDescription must be at most ${MAX_META_DESCRIPTION_LENGTH} characters`,
        {
          code: ERROR_CODES.SEO_DESCRIPTION_TOO_LONG,
          reason: "SEO_VALIDATION_FAILED",
          resource: "CONTENT_ENTRY_SEO",
          details: {
            field: "metaDescription",
            max: MAX_META_DESCRIPTION_LENGTH,
            actual: len,
          },
        }
      );
    }
  }
}

class ContentEntryService {
  // ===================== READ =====================

  /**
   * Listing entries per workspace dengan optional filter:
   * - contentTypeId atau contentTypeApiKey
   * - search (seoTitle/slug contains)
   * - isPublished
   * - pagination
   */
  async getAll(
    workspaceId,
    {
      contentTypeId,
      contentTypeApiKey,
      search = "",
      isPublished,
      page = 1,
      pageSize = 20,
    } = {}
  ) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.WORKSPACE_REQUIRED,
        reason: "VALIDATION_ERROR",
        resource: "CONTENT_ENTRIES",
      });
    }

    const where = { workspaceId };

    // resolve contentType by apiKey kalau perlu
    let finalContentTypeId = contentTypeId;
    if (!finalContentTypeId && contentTypeApiKey) {
      const ct = await prisma.contentType.findFirst({
        where: { workspaceId, apiKey: contentTypeApiKey },
        select: { id: true },
      });
      if (!ct) {
        throw ApiError.notFound("ContentType not found", {
          code: ERROR_CODES.CONTENT_TYPE_NOT_FOUND,
          reason: "CONTENT_TYPE_NOT_FOUND",
          resource: "CONTENT_TYPES",
          details: { workspaceId, apiKey: contentTypeApiKey },
        });
      }
      finalContentTypeId = ct.id;
    }
    if (finalContentTypeId) where.contentTypeId = finalContentTypeId;

    if (isPublished === "true") where.isPublished = true;
    if (isPublished === "false") where.isPublished = false;

    if (search && String(search).trim() !== "") {
      where.OR = [
        { seoTitle: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [items, total] = await Promise.all([
      contentEntryRepository.findAll({
        where,
        include: { contentType: true, values: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.contentEntry.count({ where }),
    ]);

    return {
      items,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      pages: Math.max(1, Math.ceil(total / Number(pageSize))),
    };
  }

  async getById(id, workspaceId) {
    const entry = await contentEntryRepository.findById(id, workspaceId);
    if (!entry) {
      throw ApiError.notFound("Entry not found", {
        code: ERROR_CODES.CONTENT_ENTRY_NOT_FOUND,
        reason: "ENTRY_NOT_FOUND",
        resource: "CONTENT_ENTRIES",
        details: { id, workspaceId },
      });
    }
    return entry;
  }

  /**
   * Detail dengan include relations & depth (admin/public)
   */
  async getByIdWithInclude({
    id,
    workspaceId,
    include = "",
    depth = 0,
    scope = "admin",
  }) {
    const entry = await prisma.contentEntry.findFirst({
      where: { id, workspaceId },
      include: { contentType: true, values: true },
    });
    if (!entry) {
      throw ApiError.notFound("Entry not found", {
        code: ERROR_CODES.CONTENT_ENTRY_NOT_FOUND,
        reason: "ENTRY_NOT_FOUND",
        resource: "CONTENT_ENTRIES",
        details: { id, workspaceId },
      });
    }

    if (include === "relations") {
      const relFields = await prisma.contentField.findMany({
        where: { contentTypeId: entry.contentTypeId, type: "RELATION" },
        select: { id: true },
      });
      const relFieldIds = relFields.map((f) => f.id);

      const [pairs1N, pairsM2M] = await prisma.$transaction([
        prisma.contentRelation.findMany({
          where: { fieldId: { in: relFieldIds }, fromEntryId: entry.id },
          select: { fieldId: true, toEntryId: true },
        }),
        prisma.contentRelationM2M.findMany({
          where: { relationFieldId: { in: relFieldIds }, fromEntryId: entry.id },
          select: { relationFieldId: true, toEntryId: true },
        }),
      ]);

      const map = {};
      for (const p of pairs1N) {
        const k = p.fieldId;
        map[k] = map[k] || [];
        map[k].push(p.toEntryId);
      }
      for (const p of pairsM2M) {
        const k = p.relationFieldId;
        map[k] = map[k] || [];
        map[k].push(p.toEntryId);
      }
      for (const k of Object.keys(map)) map[k] = [...new Set(map[k])];

      entry.relations = map;

      if (Number(depth) >= 1) {
        const flatIds = [...new Set(Object.values(map).flat())];
        if (flatIds.length) {
          const whereTargets = { id: { in: flatIds } };
          if (scope === "public") whereTargets.isPublished = true;

          const targets = await prisma.contentEntry.findMany({
            where: whereTargets,
            select: {
              id: true,
              slug: true,
              seoTitle: true,
              contentTypeId: true,
              isPublished: true,
              publishedAt: true,
            },
          });
          const tmap = Object.fromEntries(targets.map((t) => [t.id, t]));
          for (const k of Object.keys(entry.relations)) {
            entry.relations[k] = entry.relations[k]
              .map((tid) => tmap[tid])
              .filter(Boolean);
          }
        }
      }
    }

    return entry;
  }

  // Cari ContentType by apiKey dalam workspace
  async _resolveCTIdOrThrow(workspaceId, contentTypeApiKey) {
    const ct = await prisma.contentType.findFirst({
      where: { workspaceId, apiKey: contentTypeApiKey },
      select: { id: true },
    });
    if (!ct) {
      throw ApiError.notFound("ContentType not found", {
        code: ERROR_CODES.CONTENT_TYPE_NOT_FOUND,
        reason: "CONTENT_TYPE_NOT_FOUND",
        resource: "CONTENT_TYPES",
        details: { workspaceId, apiKey: contentTypeApiKey },
      });
    }
    return ct.id;
  }

  // 🔎 Util search untuk dropdown/multiselect relasi
  async searchForRelation({
    workspaceId,
    contentTypeApiKey,
    q = "",
    page = 1,
    pageSize = 10,
    sort = "publishedAt:desc",
    scope = "public",
  }) {
    const contentTypeId = await this._resolveCTIdOrThrow(
      workspaceId,
      contentTypeApiKey
    );

    const skip = (Number(page) - 1) * Number(pageSize);
    const [sortField, sortDir] = (sort || "publishedAt:desc").split(":");
    const orderBy = [
      { [sortField || "publishedAt"]: (sortDir || "desc").toLowerCase() },
    ];

    const where = {
      workspaceId,
      contentTypeId,
      ...(q
        ? {
            OR: [
              { seoTitle: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(scope === "public" ? { isPublished: true } : {}),
    };

    const [rows, total] = await prisma.$transaction([
      prisma.contentEntry.findMany({
        where,
        orderBy,
        skip,
        take: Number(pageSize),
        select: {
          id: true,
          slug: true,
          seoTitle: true,
          publishedAt: true,
          isPublished: true,
        },
      }),
      prisma.contentEntry.count({ where }),
    ]);

    return { rows, total, page: Number(page), pageSize: Number(pageSize) };
  }

  // ✅ Listing by ContentType + filter relasi M2M (fieldId + related)
  async listByContentTypeWithM2M({
    workspaceId,
    contentTypeApiKey,
    fieldId,
    related,
    page = 1,
    pageSize = 20,
  }) {
    const ct = await prisma.contentType.findFirst({
      where: { workspaceId, apiKey: contentTypeApiKey },
      select: { id: true },
    });
    if (!ct) {
      throw ApiError.notFound("ContentType not found", {
        code: ERROR_CODES.CONTENT_TYPE_NOT_FOUND,
        reason: "CONTENT_TYPE_NOT_FOUND",
        resource: "CONTENT_TYPES",
        details: { workspaceId, apiKey: contentTypeApiKey },
      });
    }

    return findManyWithM2mRelated({
      workspaceId,
      contentTypeId: ct.id,
      fieldId,
      related,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  // ===================== CREATE =====================
  async create(data) {
    if (!data?.workspaceId || !data?.contentTypeId) {
      throw ApiError.badRequest(
        "workspaceId and contentTypeId are required",
        {
          code: ERROR_CODES.CONTENT_ENTRY_CREATE_VALIDATION_ERROR,
          reason: "VALIDATION_ERROR",
          resource: "CONTENT_ENTRIES",
        }
      );
    }

    // Normalisasi SEO (trim & keywords → array)
    data = normalizeSeoFields(data);

    // Validasi panjang SEO (B1 & B2)
    validateSeoLengths({
      seoTitle: data.seoTitle,
      metaDescription: data.metaDescription,
    });

    // 🔧 Ambil ContentType untuk cek seoEnabled (multi-tenant aware)
    const contentType = await prisma.contentType.findFirst({
      where: {
        id: data.contentTypeId,
        workspaceId: data.workspaceId,
      },
      select: { id: true, seoEnabled: true },
    });
    if (!contentType) {
      throw ApiError.notFound("ContentType not found", {
        code: ERROR_CODES.CONTENT_TYPE_NOT_FOUND,
        reason: "CONTENT_TYPE_NOT_FOUND",
        resource: "CONTENT_TYPES",
        details: {
          workspaceId: data.workspaceId,
          contentTypeId: data.contentTypeId,
        },
      });
    }

    const { fieldValues, relations, generated } = await enforceOnPayload({
      contentTypeId: data.contentTypeId,
      entryId: null,
      values: data.values || [],
    });

    // Slug tetap dihitung seperti sebelumnya
    let finalSlug = data.slug ?? null;
    if (!finalSlug && data.seoTitle) finalSlug = generateSlug(data.seoTitle);
    if (!finalSlug && generated.slug) finalSlug = generated.slug;

    // 🔒 Cek duplicate slug per (workspace, contentType)
    if (finalSlug) {
      const existingSlug = await contentEntryRepository.isSlugTaken(
        data.workspaceId,
        data.contentTypeId,
        finalSlug
      );
      if (existingSlug) {
        throw ApiError.conflict("Slug already in use", {
          code: ERROR_CODES.SLUG_CONFLICT,
          reason: "SLUG_ALREADY_EXISTS",
          resource: "CONTENT_ENTRIES",
          details: {
            workspaceId: data.workspaceId,
            contentTypeId: data.contentTypeId,
            slug: finalSlug,
          },
        });
      }
    }

    // 🔐 Enforce plan limit: maxEntries per workspace
    await enforcePlanLimit(data.workspaceId, PLAN_LIMIT_ACTIONS.ADD_ENTRY);

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.contentEntry.create({
        data: {
          workspaceId: data.workspaceId,
          contentTypeId: data.contentTypeId,
          slug: finalSlug,
          // 🔐 Enforce seoEnabled: hanya simpan SEO kalau diizinkan di ContentType
          seoTitle: contentType.seoEnabled ? data.seoTitle ?? null : null,
          metaDescription: contentType.seoEnabled
            ? data.metaDescription ?? null
            : null,
          keywords: contentType.seoEnabled ? data.keywords ?? [] : [],
          isPublished: !!data.isPublished,
          publishedAt: data.publishedAt ?? null,
          createdById: data.createdById ?? null,
          updatedById: data.updatedById ?? null,
        },
      });

      for (const fv of fieldValues) {
        await tx.fieldValue.create({
          data: {
            entryId: created.id,
            fieldId: fv.fieldId,
            [fv.key]: fv.value,
          },
        });
      }

      for (const r of relations) {
        for (const toId of r.targetIds) {
          await tx.contentRelation.create({
            data: {
              workspaceId: data.workspaceId,
              fieldId: r.fieldId,
              fromEntryId: created.id,
              toEntryId: toId,
            },
          });
        }
      }

      return created;
    });

    // 🔁 DENORM HOOK: target entry baru dibuat → sinkronkan semua sumber yang terkait
    await recomputeDenormForTargetChange({
      workspaceId: data.workspaceId,
      targetEntryId: entry.id,
    });

    return entry;
  }

  // ===================== UPDATE =====================
  async update(id, workspaceId, data) {
    const existing = await contentEntryRepository.findById(id, workspaceId);
    if (!existing) {
      throw ApiError.notFound("Entry not found", {
        code: ERROR_CODES.CONTENT_ENTRY_NOT_FOUND,
        reason: "ENTRY_NOT_FOUND",
        resource: "CONTENT_ENTRIES",
        details: { id, workspaceId },
      });
    }

    // Normalisasi SEO (trim & keywords → array)
    data = normalizeSeoFields(data);

    // Tentukan SEO yang akan disimpan (gabungan existing + patch)
    const seoTitleToCheck =
      data.seoTitle !== undefined ? data.seoTitle : existing.seoTitle;
    const metaDescriptionToCheck =
      data.metaDescription !== undefined
        ? data.metaDescription
        : existing.metaDescription;

    // Validasi panjang SEO (B1 & B2)
    validateSeoLengths({
      seoTitle: seoTitleToCheck,
      metaDescription: metaDescriptionToCheck,
    });

    // 🔧 Ambil ContentType untuk cek seoEnabled (multi-tenant aware)
    const contentType = await prisma.contentType.findFirst({
      where: {
        id: existing.contentTypeId,
        workspaceId: existing.workspaceId,
      },
      select: { id: true, seoEnabled: true },
    });

    let finalSlug = data.slug ?? existing.slug ?? null;
    if (!data.slug && data.seoTitle && !existing.slug) {
      finalSlug = generateSlug(data.seoTitle);
    }

    // 🔒 Cek duplicate slug per (workspace, contentType) (exclude entry ini)
    if (finalSlug) {
      const existingSlug = await contentEntryRepository.isSlugTaken(
        existing.workspaceId,
        existing.contentTypeId,
        finalSlug,
        id
      );
      if (existingSlug) {
        throw ApiError.conflict("Slug already in use", {
          code: ERROR_CODES.SLUG_CONFLICT,
          reason: "SLUG_ALREADY_EXISTS",
          resource: "CONTENT_ENTRIES",
          details: {
            workspaceId: existing.workspaceId,
            contentTypeId: existing.contentTypeId,
            slug: finalSlug,
            entryId: id,
          },
        });
      }
    }

    let fieldValues = [];
    let relations = [];
    if (Array.isArray(data.values) && data.values.length > 0) {
      const enforced = await enforceOnPayload({
        contentTypeId: existing.contentTypeId,
        entryId: id,
        values: data.values,
      });
      fieldValues = enforced.fieldValues;
      relations = enforced.relations;
      if (!finalSlug && enforced.generated?.slug) {
        finalSlug = enforced.generated.slug;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 🔐 Enforce seoEnabled di level update:
      // - Jika seoEnabled = false → SEO fields selalu dibersihkan (auto-clean)
      // - Jika true → pakai data baru kalau ada, fallback ke existing
      const seoPatch =
        contentType && contentType.seoEnabled === false
          ? {
              seoTitle: null,
              metaDescription: null,
              keywords: [],
            }
          : {
              seoTitle: data.seoTitle ?? existing.seoTitle,
              metaDescription: data.metaDescription ?? existing.metaDescription,
              keywords: data.keywords ?? existing.keywords,
            };

      const saved = await tx.contentEntry.update({
        where: { id },
        data: {
          slug: finalSlug,
          ...seoPatch,
          isPublished:
            typeof data.isPublished === "boolean"
              ? data.isPublished
              : existing.isPublished,
          publishedAt: data.publishedAt ?? existing.publishedAt,
          updatedById: data.updatedById ?? existing.updatedById,
        },
      });

      if (fieldValues.length > 0) {
        const fieldIdsChanged = [...new Set(fieldValues.map((fv) => fv.fieldId))];
        await tx.fieldValue.deleteMany({
          where: { entryId: id, fieldId: { in: fieldIdsChanged } },
        });
        for (const fv of fieldValues) {
          await tx.fieldValue.create({
            data: {
              entryId: id,
              fieldId: fv.fieldId,
              [fv.key]: fv.value,
            },
          });
        }
      }

      if (relations.length > 0) {
        const relFieldIds = [...new Set(relations.map((r) => r.fieldId))];
        await tx.contentRelation.deleteMany({
          where: { fromEntryId: id, fieldId: { in: relFieldIds } },
        });
        for (const r of relations) {
          for (const toId of r.targetIds) {
            await tx.contentRelation.create({
              data: {
                workspaceId: existing.workspaceId,
                fieldId: r.fieldId,
                fromEntryId: id,
                toEntryId: toId,
              },
            });
          }
        }
      }

      return saved;
    });

    // 🔁 DENORM HOOK: target entry berubah → sinkronkan semua sumber yang terkait
    await recomputeDenormForTargetChange({
      workspaceId: existing.workspaceId,
      targetEntryId: id,
    });

    return updated;
  }

  // ===================== DELETE / PUBLISH =====================

  async delete(id, workspaceId) {
    const existing = await contentEntryRepository.findById(id, workspaceId);
    if (!existing) {
      throw ApiError.notFound("Entry not found", {
        code: ERROR_CODES.CONTENT_ENTRY_NOT_FOUND,
        reason: "ENTRY_NOT_FOUND",
        resource: "CONTENT_ENTRIES",
        details: { id, workspaceId },
      });
    }
    await contentEntryRepository.delete(id, workspaceId);
    return { message: "Entry deleted" };
  }

  async publish(id, workspaceId) {
    const existing = await contentEntryRepository.findById(id, workspaceId);
    if (!existing) {
      throw ApiError.notFound("Entry not found", {
        code: ERROR_CODES.CONTENT_ENTRY_NOT_FOUND,
        reason: "ENTRY_NOT_FOUND",
        resource: "CONTENT_ENTRIES",
        details: { id, workspaceId },
      });
    }
    const updated = await contentEntryRepository.publish(id, workspaceId);
    return updated;
  }
}

export default new ContentEntryService();
