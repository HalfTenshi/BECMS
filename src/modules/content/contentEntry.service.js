import contentEntryRepository, { findManyWithM2mRelated } from "./contentEntry.repository.js";
import prisma from "../../config/prismaClient.js";
import { generateSlug } from "../../utils/slugGenerator.js";
import { enforceOnPayload } from "./entry.validation.js";
import { recomputeDenormForTargetChange } from "../../services/denorm.service.js";

class ContentEntryService {
  // ===================== READ =====================
  async getAll() {
    return await contentEntryRepository.findAll();
  }

  async getById(id) {
    const entry = await contentEntryRepository.findById(id);
    if (!entry) throw new Error("Entry not found");
    return entry;
  }

  // ✅ NEW: getById dengan dukungan include=relations & depth
  /**
   * @param {Object} params
   * @param {string} params.id
   * @param {string} params.workspaceId
   * @param {string} [params.include=""]
   * @param {number} [params.depth=0]
   * @param {"admin"|"public"} [params.scope="admin"]
   */
  async getByIdWithInclude({ id, workspaceId, include = "", depth = 0, scope = "admin" }) {
    const entry = await prisma.contentEntry.findFirst({
      where: { id, workspaceId },
      include: { contentType: true, values: true },
    });
    if (!entry) throw new Error("Entry not found");

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
          const where = { id: { in: flatIds } };
          if (scope === "public") where.isPublished = true;

          const targets = await prisma.contentEntry.findMany({
            where,
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
            entry.relations[k] = entry.relations[k].map((tid) => tmap[tid]).filter(Boolean);
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
    if (!ct) throw new Error("ContentType not found");
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
    const contentTypeId = await this._resolveCTIdOrThrow(workspaceId, contentTypeApiKey);

    const skip = (Number(page) - 1) * Number(pageSize);
    const [sortField, sortDir] = (sort || "publishedAt:desc").split(":");
    const orderBy = [{ [sortField || "publishedAt"]: (sortDir || "desc").toLowerCase() }];

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
    if (!ct) throw new Error("ContentType not found");

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
  /**
   * data:
   * {
   *   workspaceId: string,
   *   contentTypeId: string,
   *   values: [{ apiKey, value }],
   *   slug?, seoTitle?, metaDescription?, keywords?, isPublished?, publishedAt?,
   *   createdById?, updatedById?
   * }
   */
  async create(data) {
    if (!data.workspaceId || !data.contentTypeId) {
      throw new Error("workspaceId and contentTypeId required");
    }

    const { fieldValues, relations, generated } = await enforceOnPayload({
      contentTypeId: data.contentTypeId,
      entryId: null,
      values: data.values || [],
    });

    let finalSlug = data.slug ?? null;
    if (!finalSlug && data.seoTitle) finalSlug = generateSlug(data.seoTitle);
    if (!finalSlug && generated.slug) finalSlug = generated.slug;

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.contentEntry.create({
        data: {
          workspaceId: data.workspaceId,
          contentTypeId: data.contentTypeId,
          slug: finalSlug,
          seoTitle: data.seoTitle ?? null,
          metaDescription: data.metaDescription ?? null,
          keywords: data.keywords ?? [],
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
  /**
   * data:
   * {
   *   values?: [{ apiKey, value }],
   *   slug?, seoTitle?, metaDescription?, keywords?, isPublished?, publishedAt?,
   *   updatedById?
   * }
   */
  async update(id, data) {
    const existing = await contentEntryRepository.findById(id);
    if (!existing) throw new Error("Entry not found");

    let finalSlug = data.slug ?? existing.slug ?? null;
    if (!data.slug && data.seoTitle && !existing.slug) {
      finalSlug = generateSlug(data.seoTitle);
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
      if (!finalSlug && enforced.generated?.slug) finalSlug = enforced.generated.slug;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.contentEntry.update({
        where: { id },
        data: {
          slug: finalSlug,
          seoTitle: data.seoTitle ?? existing.seoTitle,
          metaDescription: data.metaDescription ?? existing.metaDescription,
          keywords: data.keywords ?? existing.keywords,
          isPublished:
            typeof data.isPublished === "boolean" ? data.isPublished : existing.isPublished,
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
  async delete(id) {
    return await contentEntryRepository.delete(id);
  }

  async publish(id) {
    return await contentEntryRepository.publish(id);
  }
}

export default new ContentEntryService();
