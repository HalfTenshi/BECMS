// src/modules/content/relations.expander.js
import prisma from "../../config/prismaClient.js";

/**
 * Ambil field RELATION untuk suatu ContentType dan config relasinya.
 * Mengikuti skema kamu:
 * - ContentField { type: RELATION, relation: RelationConfig? }
 * - RelationConfig { kind: RelationKind, targetContentTypeId }
 */
async function getRelationFields({ contentTypeId }) {
  return prisma.contentField.findMany({
    where: { contentTypeId, type: "RELATION" },
    select: {
      id: true,
      apiKey: true,
      name: true,
      relation: {
        select: {
          id: true,
          kind: true,                // ONE_TO_ONE | ONE_TO_MANY | MANY_TO_ONE | MANY_TO_MANY
          targetContentTypeId: true,
        },
      },
    },
  });
}

/**
 * Ambil link relasi secara bulk untuk sekumpulan entries & fields.
 * Mengikuti skema kamu:
 * - ContentRelation: { workspaceId, fieldId, fromEntryId, toEntryId }
 * - ContentRelationM2M: { workspaceId, relationFieldId, fromEntryId, toEntryId }
 */
async function fetchRelationLinksBulk({ workspaceId = null, fromEntryIds, relationFields }) {
  if (relationFields.length === 0 || fromEntryIds.length === 0) {
    return { oneManyLinks: [], m2mLinks: [] };
  }

  const fieldIds = relationFields.map(f => f.id);
  const hasM2M = relationFields.some(f => f.relation?.kind === "MANY_TO_MANY");
  const hasNonM2M = relationFields.some(f => f.relation?.kind !== "MANY_TO_MANY");

  let oneManyLinks = [];
  let m2mLinks = [];

  if (hasNonM2M) {
    oneManyLinks = await prisma.contentRelation.findMany({
      where: {
        fromEntryId: { in: fromEntryIds },
        fieldId: { in: fieldIds.filter(id => {
          const f = relationFields.find(ff => ff.id === id);
          return f?.relation?.kind !== "MANY_TO_MANY";
        }) },
        ...(workspaceId ? { workspaceId } : {}),
      },
      select: { fromEntryId: true, fieldId: true, toEntryId: true },
    });
  }

  if (hasM2M) {
    m2mLinks = await prisma.contentRelationM2M.findMany({
      where: {
        fromEntryId: { in: fromEntryIds },
        relationFieldId: { in: fieldIds.filter(id => {
          const f = relationFields.find(ff => ff.id === id);
          return f?.relation?.kind === "MANY_TO_MANY";
        }) },
        ...(workspaceId ? { workspaceId } : {}),
      },
      select: { fromEntryId: true, relationFieldId: true, toEntryId: true },
    });
  }

  return { oneManyLinks, m2mLinks };
}

/**
 * Ambil ringkasan entry target (published-only).
 * summary = "basic" -> select subset ringkas
 * summary = "full"  -> include: { values: true }
 */
async function fetchEntrySummaries({ entryIds, summary = "basic" }) {
  if (!entryIds || entryIds.length === 0) return [];

  const includeValues = summary === "full";
  return prisma.contentEntry.findMany({
    where: { id: { in: entryIds }, isPublished: true },
    orderBy: { publishedAt: "desc" },
    include: includeValues ? { values: true } : undefined,
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

/**
 * Expand relasi utk depth 1.
 * Hasil: Map<entryId, { [fieldApiKey]: object | object[] }>
 */
async function expandRelationsDepth1({
  workspaceId = null,
  entries,
  relationFields,
  summary = "basic",
  allowedFieldApiKeys = null, // Set([...]) atau null
}) {
  const out = new Map(entries.map(e => [e.id, {}]));
  if (relationFields.length === 0 || entries.length === 0) return out;

  // Filter field berdasar whitelist API key bila ada
  const filtered = relationFields.filter(f =>
    !allowedFieldApiKeys || allowedFieldApiKeys.has(f.apiKey)
  );
  if (filtered.length === 0) return out;

  const fromEntryIds = entries.map(e => e.id);

  const { oneManyLinks, m2mLinks } = await fetchRelationLinksBulk({
    workspaceId,
    fromEntryIds,
    relationFields: filtered,
  });

  // Kumpulkan semua target IDs
  const allTargetIds = new Set();
  for (const l of oneManyLinks) allTargetIds.add(l.toEntryId);
  for (const l of m2mLinks) allTargetIds.add(l.toEntryId);

  const targets = await fetchEntrySummaries({
    entryIds: Array.from(allTargetIds),
    summary,
  });
  const targetById = new Map(targets.map(t => [t.id, t]));

  // Buat index fieldId -> field meta (untuk baca kind & apiKey)
  const fieldMetaById = new Map(filtered.map(f => [f.id, f]));

  // Isikan hasil utk ContentRelation (ONE/MANY-TO-ONE/MANY)
  for (const link of oneManyLinks) {
    const bucket = out.get(link.fromEntryId);
    if (!bucket) continue;

    const meta = fieldMetaById.get(link.fieldId);
    if (!meta) continue;

    const target = targetById.get(link.toEntryId);
    if (!target) continue;

    const kind = meta.relation?.kind;

    // Single vs multi berdasarkan kind
    if (kind === "ONE_TO_ONE" || kind === "MANY_TO_ONE") {
      // Single
      bucket[meta.apiKey] = target;
    } else if (kind === "ONE_TO_MANY") {
      // Multi
      if (!Array.isArray(bucket[meta.apiKey])) bucket[meta.apiKey] = [];
      // Hindari duplikat
      if (!bucket[meta.apiKey].some(v => v.id === target.id)) {
        bucket[meta.apiKey].push(target);
      }
    } else {
      // fallback aman: array
      if (!Array.isArray(bucket[meta.apiKey])) bucket[meta.apiKey] = [];
      if (!bucket[meta.apiKey].some(v => v.id === target.id)) {
        bucket[meta.apiKey].push(target);
      }
    }
  }

  // Isikan hasil utk ContentRelationM2M (selalu multi)
  for (const link of m2mLinks) {
    const bucket = out.get(link.fromEntryId);
    if (!bucket) continue;

    const meta = fieldMetaById.get(link.relationFieldId);
    if (!meta) continue;

    const target = targetById.get(link.toEntryId);
    if (!target) continue;

    if (!Array.isArray(bucket[meta.apiKey])) bucket[meta.apiKey] = [];
    if (!bucket[meta.apiKey].some(v => v.id === target.id)) {
      bucket[meta.apiKey].push(target);
    }
  }

  return out;
}

/**
 * API utama untuk ekspansi relasi.
 * - entries         : array ContentEntry (hasil findMany/findFirst)
 * - contentTypeId   : ContentType.id untuk membaca daftar field RELATION
 * - workspaceId     : opsional, untuk filter link relasi (aman multi-tenant)
 * - depth           : default 1, batasi hingga 3
 * - summary         : "basic" | "full" (full = target include values)
 * - allowedFieldApiKeys : Set([...]) untuk whitelist field RELATION
 */
export async function expandRelations({
  workspaceId = null,
  entries,
  contentTypeId,
  depth = 1,
  summary = "basic",
  allowedFieldApiKeys = null,
}) {
  if (!entries || entries.length === 0) return new Map();

  const relationFields = await getRelationFields({ contentTypeId });
  // Depth 1
  const level1 = await expandRelationsDepth1({
    workspaceId,
    entries,
    relationFields,
    summary,
    allowedFieldApiKeys,
  });

  // Untuk sekarang, hentikan di depth 1 agar aman & cepat.
  // (Bisa dikembangkan: kumpulkan target per targetContentTypeId, lalu rekursif.)
  if (depth <= 1) return level1;

  return level1;
}

export default {
  expandRelations,
};
