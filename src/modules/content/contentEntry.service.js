// src/modules/content/contentEntry.service.js
import contentEntryRepository, {
  findManyWithM2mRelated,
} from "./contentEntry.repository.js";
import prisma from "../../config/prismaClient.js";
import { generateSlug } from "../../utils/slugGenerator.js";
import { enforceOnPayload } from "./entry.validation.js";
import { recomputeDenormForTargetChange } from "../../services/denorm.service.js";
import { normalizeSeoFields } from "../../utils/seoUtils.js";
import {
  enforcePlanLimit,
  PLAN_LIMIT_ACTIONS,
} from "../../services/planLimit.service.js";

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
    if (!workspaceId) throw new Error("workspaceId is required");

    const where = { workspaceId };

    // resolve contentType by apiKey kalau perlu
    let finalContentTypeId = contentTypeId;
    if (!finalContentTypeId && contentTypeApiKey) {
      const ct = await prisma.contentType.findFirst({
        where: { workspaceId, apiKey: contentTypeApiKey },
        select: { id: true },
      });
      if (!ct) {
        const e = new Error("ContentType not found");
        e.status = 404;
        throw e;
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
      const e = new Error("Entry not found");
      e.status = 404;
      throw e;
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
      const e = new Error("Entry not found");
      e.status = 404;
      throw e;
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
      const e = new Error("ContentType not found");
      e.status = 404;
      throw e;
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
      const e = new Error("ContentType not found");
      e.status = 404;
      throw e;
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
    if (!data.workspaceId || !data.contentTypeId) {
      throw new Error("workspaceId and contentTypeId required");
    }

    // Normalisasi SEO (limit 160 & keywords → array) via util global
    data = normalizeSeoFields(data);

    // 🔧 Ambil ContentType untuk cek seoEnabled (multi-tenant aware)
    const contentType = await prisma.contentType.findFirst({
      where: {
        id: data.contentTypeId,
        workspaceId: data.workspaceId,
      },
      select: { id: true, seoEnabled: true },
    });
    if (!contentType) {
      const e = new Error("ContentType not found");
      e.status = 404;
      throw e;
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
        const e = new Error("Slug already in use");
        e.status = 409;
        e.code = "SLUG_CONFLICT";
        throw e;
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
      const e = new Error("Entry not found");
      e.status = 404;
      throw e;
    }

    // Normalisasi SEO (limit 160 & keywords → array) via util global
    data = normalizeSeoFields(data);

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
        const e = new Error("Slug already in use");
        e.status = 409;
        e.code = "SLUG_CONFLICT";
        throw e;
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
      const e = new Error("Entry not found");
      e.status = 404;
      throw e;
    }
    await contentEntryRepository.delete(id, workspaceId);
    return { message: "Entry deleted" };
  }

  async publish(id, workspaceId) {
    const existing = await contentEntryRepository.findById(id, workspaceId);
    if (!existing) {
      const e = new Error("Entry not found");
      e.status = 404;
      throw e;
    }
    const updated = await contentEntryRepository.publish(id, workspaceId);
    return updated;
  }
}

export default new ContentEntryService();
