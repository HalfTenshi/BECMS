// src/routes/public/content.public.routes.js
import express from "express";
import prisma from "../../config/prismaClient.js";
import { workspaceContext } from "../../middlewares/workspace.js";
import contentEntryController from "../../modules/content/contentEntry.controller.js";

const router = express.Router();

/** =========================
 *  HELPER: Ekspansi Relasi
 *  (disesuaikan dg skema kamu)
 *  - ContentField.type = "RELATION" + field.relation: RelationConfig { kind, targetContentTypeId }
 *  - ContentRelation (O2O/O2M/M2O)  : { workspaceId, fieldId, fromEntryId, toEntryId }
 *  - ContentRelationM2M (M2M)       : { workspaceId, relationFieldId, fromEntryId, toEntryId }
 *  ========================= */

/** Ambil field RELATION utk CT tertentu */
async function getRelationFields({ contentTypeId }) {
  const fields = await prisma.contentField.findMany({
    where: { contentTypeId, type: "RELATION" },
    select: {
      id: true,
      apiKey: true,
      name: true,
      relation: {
        select: {
          id: true,
          kind: true, // ONE_TO_ONE | ONE_TO_MANY | MANY_TO_ONE | MANY_TO_MANY
          targetContentTypeId: true,
        },
      },
    },
  });
  // pastikan hanya yg punya relation config
  return fields.filter((f) => !!f.relation);
}

/** Ambil link relasi bulk utk sekumpulan entries+fields */
async function fetchRelationLinksBulk({ workspaceId = null, fromEntryIds, relationFields }) {
  if (!relationFields.length || !fromEntryIds.length) {
    return { oneManyLinks: [], m2mLinks: [] };
  }
  const fieldIds = relationFields.map((f) => f.id);
  const hasM2M = relationFields.some((f) => f.relation?.kind === "MANY_TO_MANY");
  const hasNonM2M = relationFields.some((f) => f.relation?.kind !== "MANY_TO_MANY");

  let oneManyLinks = [];
  let m2mLinks = [];

  if (hasNonM2M) {
    const nonM2MFieldIds = relationFields
      .filter((f) => f.relation?.kind !== "MANY_TO_MANY")
      .map((f) => f.id);

    oneManyLinks = await prisma.contentRelation.findMany({
      where: {
        fromEntryId: { in: fromEntryIds },
        fieldId: { in: nonM2MFieldIds },
        ...(workspaceId ? { workspaceId } : {}),
      },
      select: { fromEntryId: true, fieldId: true, toEntryId: true },
    });
  }

  if (hasM2M) {
    const m2mFieldIds = relationFields
      .filter((f) => f.relation?.kind === "MANY_TO_MANY")
      .map((f) => f.id);

    m2mLinks = await prisma.contentRelationM2M.findMany({
      where: {
        fromEntryId: { in: fromEntryIds },
        relationFieldId: { in: m2mFieldIds },
        ...(workspaceId ? { workspaceId } : {}),
      },
      select: { fromEntryId: true, relationFieldId: true, toEntryId: true },
    });
  }

  return { oneManyLinks, m2mLinks };
}

/** Ambil ringkasan entry target (published-only) */
async function fetchEntrySummaries({ entryIds, summary = "basic" }) {
  if (!entryIds || entryIds.length === 0) return [];
  const includeValues = summary === "full";

  return prisma.contentEntry.findMany({
    where: { id: { in: entryIds }, isPublished: true },
    orderBy: { publishedAt: "desc" },
    include: includeValues
      ? {
          values: {
            select: {
              fieldId: true,
              valueString: true,
              valueNumber: true,
              valueBoolean: true,
              valueDate: true,
              valueJson: true,
            },
          },
        }
      : undefined,
    select: includeValues
      ? undefined
      : {
          id: true,
          slug: true,
          seoTitle: true,
          metaDescription: true,
          publishedAt: true,
        },
  });
}

/** Expand relasi utk depth 1 → Map<entryId, { [fieldApiKey]: obj | obj[] }> */
async function expandRelationsDepth1({
  workspaceId = null,
  entries,
  relationFields,
  summary = "basic",
  allowedFieldApiKeys = null, // Set([...]) atau null
}) {
  const out = new Map(entries.map((e) => [e.id, {}]));
  if (!relationFields.length || !entries.length) return out;

  const filtered = relationFields.filter(
    (f) => !allowedFieldApiKeys || allowedFieldApiKeys.has(f.apiKey)
  );
  if (!filtered.length) return out;

  const fromEntryIds = entries.map((e) => e.id);
  const { oneManyLinks, m2mLinks } = await fetchRelationLinksBulk({
    workspaceId,
    fromEntryIds,
    relationFields: filtered,
  });

  const allTargetIds = new Set();
  for (const l of oneManyLinks) allTargetIds.add(l.toEntryId);
  for (const l of m2mLinks) allTargetIds.add(l.toEntryId);

  const targets = await fetchEntrySummaries({
    entryIds: Array.from(allTargetIds),
    summary,
  });
  const targetById = new Map(targets.map((t) => [t.id, t]));

  const fieldMetaById = new Map(filtered.map((f) => [f.id, f]));

  // Non-M2M
  for (const link of oneManyLinks) {
    const bucket = out.get(link.fromEntryId);
    if (!bucket) continue;

    const meta = fieldMetaById.get(link.fieldId);
    if (!meta) continue;

    const target = targetById.get(link.toEntryId);
    if (!target) continue;

    const kind = meta.relation?.kind; // ONE_TO_ONE | ONE_TO_MANY | MANY_TO_ONE

    if (kind === "ONE_TO_ONE" || kind === "MANY_TO_ONE") {
      // single
      bucket[meta.apiKey] = target;
    } else if (kind === "ONE_TO_MANY") {
      // multi
      if (!Array.isArray(bucket[meta.apiKey])) bucket[meta.apiKey] = [];
      if (!bucket[meta.apiKey].some((v) => v.id === target.id)) {
        bucket[meta.apiKey].push(target);
      }
    } else {
      // fallback → array
      if (!Array.isArray(bucket[meta.apiKey])) bucket[meta.apiKey] = [];
      if (!bucket[meta.apiKey].some((v) => v.id === target.id)) {
        bucket[meta.apiKey].push(target);
      }
    }
  }

  // M2M
  for (const link of m2mLinks) {
    const bucket = out.get(link.fromEntryId);
    if (!bucket) continue;

    const meta = fieldMetaById.get(link.relationFieldId);
    if (!meta) continue;

    const target = targetById.get(link.toEntryId);
    if (!target) continue;

    if (!Array.isArray(bucket[meta.apiKey])) bucket[meta.apiKey] = [];
    if (!bucket[meta.apiKey].some((v) => v.id === target.id)) {
      bucket[meta.apiKey].push(target);
    }
  }

  return out;
}

/** API utama ekspansi relasi (batasi depth=1 untuk performa/simplicity) */
async function expandRelations({
  workspaceId = null,
  entries,
  contentTypeId,
  depth = 1,
  summary = "basic",
  allowedFieldApiKeys = null,
}) {
  if (!entries || entries.length === 0) return new Map();
  const relationFields = await getRelationFields({ contentTypeId });
  const level1 = await expandRelationsDepth1({
    workspaceId,
    entries,
    relationFields,
    summary,
    allowedFieldApiKeys,
  });
  if (depth <= 1) return level1;
  return level1; // TODO: bisa dikembangkan untuk rekursi per targetContentTypeId
}

/** =========================
 *  UTIL: resolve ContentType.id dari apiKey
 *  ========================= */
async function resolveCTIdOrThrow(workspaceId, apiKey) {
  const ct = await prisma.contentType.findFirst({
    where: { workspaceId, apiKey },
    select: { id: true },
  });
  if (!ct) throw new Error("Content type not found");
  return ct.id;
}

/**
 * GET /api/content/:contentType
 * List PUBLISHED ONLY + SEO fields
 * Query:
 *  - q        : string (search seoTitle/slug/metaDescription)
 *  - page     : number (default 1)
 *  - pageSize : number (default 10, max 100)
 *  - sort     : "publishedAt:desc" default | "publishedAt:asc" | "seoTitle:asc" | ...
 *  - include  : "values" dan/atau "relations" (comma-separated)
 *  - relations: "author,brand,categories" (filter field RELATION by apiKey)
 *  - relationsDepth   : number (default 1; saat ini efektif 1)
 *  - relationsSummary : "basic" | "full" (full = target include values)
 */
router.get("/:contentType", workspaceContext, async (req, res) => {
  try {
    const workspaceId = req.ctx?.workspaceId || req.headers["x-workspace-id"];
    if (!workspaceId) return res.status(400).json({ message: "workspaceId required" });

    const { contentType } = req.params;
    const {
      q = "",
      page = 1,
      pageSize = 10,
      sort = "publishedAt:desc",
      include = "",
      relations = "",
      relationsDepth = 1,
      relationsSummary = "basic",
    } = req.query;

    const contentTypeId = await resolveCTIdOrThrow(workspaceId, contentType);

    // parse include flags
    const includeSet = new Set(
      String(include)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const wantValues = includeSet.has("values");
    const wantRelations = includeSet.has("relations");

    const relationKeys = new Set(
      String(relations)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const depth = Math.max(1, Math.min(3, Number(relationsDepth || 1)));
    const summary = relationsSummary === "full" ? "full" : "basic";

    // parsing sort
    const [sortField, sortDir] = String(sort).split(":");
    const orderBy = [{ [sortField || "publishedAt"]: (sortDir || "desc").toLowerCase() }];

    // filter published-only + optional search
    const where = {
      workspaceId,
      contentTypeId,
      isPublished: true,
      ...(q
        ? {
            OR: [
              { seoTitle: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { metaDescription: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const take = Math.max(1, Math.min(100, Number(pageSize)));
    const skip = (Math.max(1, Number(page)) - 1) * take;

    // select vs include values
    const selectBase = {
      id: true,
      slug: true,
      seoTitle: true,
      metaDescription: true,
      keywords: true,
      publishedAt: true,
      createdAt: true,
    };

    const listQuery =
      wantValues
        ? {
            where,
            orderBy,
            skip,
            take,
            include: {
              values: {
                select: {
                  fieldId: true,
                  valueString: true,
                  valueNumber: true,
                  valueBoolean: true,
                  valueDate: true,
                  valueJson: true,
                },
              },
            },
          }
        : {
            where,
            orderBy,
            skip,
            take,
            select: selectBase,
          };

    const [items, total] = await Promise.all([
      prisma.contentEntry.findMany(listQuery),
      prisma.contentEntry.count({ where }),
    ]);

    // expand relations (optional)
    if (wantRelations && items.length > 0) {
      const map = await expandRelations({
        workspaceId,
        entries: items,
        contentTypeId,
        depth,
        summary,
        allowedFieldApiKeys: relationKeys.size ? relationKeys : null,
      });
      for (const it of items) {
        it._relations = map.get(it.id) || {};
      }
    }

    res.json({
      rows: items,
      total,
      page: Number(page),
      pageSize: take,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || "Server error" });
  }
});

/**
 * GET /api/content/:contentType/:slug
 * Detail PUBLISHED ONLY + SEO fields
 * Query:
 *  - include=values[,relations]
 *  - relations=author,brand,...
 *  - relationsDepth=1..3 (efektif 1)
 *  - relationsSummary=basic|full
 */
router.get("/:contentType/:slug", workspaceContext, async (req, res) => {
  try {
    const workspaceId = req.ctx?.workspaceId || req.headers["x-workspace-id"];
    if (!workspaceId) return res.status(400).json({ message: "workspaceId required" });

    const { contentType, slug } = req.params;
    const {
      include = "",
      relations = "",
      relationsDepth = 1,
      relationsSummary = "basic",
    } = req.query;

    const contentTypeId = await resolveCTIdOrThrow(workspaceId, contentType);

    const includeSet = new Set(
      String(include)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const wantValues = includeSet.has("values");
    const wantRelations = includeSet.has("relations");

    const relationKeys = new Set(
      String(relations)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const depth = Math.max(1, Math.min(3, Number(relationsDepth || 1)));
    const summary = relationsSummary === "full" ? "full" : "basic";

    const selectBase = {
      id: true,
      slug: true,
      seoTitle: true,
      metaDescription: true,
      keywords: true,
      publishedAt: true,
      createdAt: true,
    };

    const detailQuery =
      wantValues
        ? {
            where: { workspaceId, contentTypeId, slug, isPublished: true },
            include: {
              values: {
                select: {
                  fieldId: true,
                  valueString: true,
                  valueNumber: true,
                  valueBoolean: true,
                  valueDate: true,
                  valueJson: true,
                },
              },
            },
          }
        : {
            where: { workspaceId, contentTypeId, slug, isPublished: true },
            select: selectBase,
          };

    const item = await prisma.contentEntry.findFirst(detailQuery);

    if (!item) return res.status(404).json({ message: "Entry not found or not published" });

    if (wantRelations) {
      const map = await expandRelations({
        workspaceId,
        entries: [item],
        contentTypeId,
        depth,
        summary,
        allowedFieldApiKeys: relationKeys.size ? relationKeys : null,
      });
      item._relations = map.get(item.id) || {};
    }

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || "Server error" });
  }
});

/**
 * Search entries untuk relation picker (public/admin sama-sama bisa pakai endpoint ini)
 * GET /api/content/:contentType/search
 */
router.get("/:contentType/search", workspaceContext, contentEntryController.searchForRelation);

export default router;
