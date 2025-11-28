// src/modules/content/relations.expander.js
import prisma from "../../config/prismaClient.js";

/**
 * Ambil field RELATION untuk suatu ContentType dan config-nya.
 *
 * Skema:
 * - ContentField {
 *     id,
 *     apiKey,
 *     name,
 *     type: "RELATION",
 *     relation: { id, kind, targetContentTypeId }
 *   }
 */
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

  // Pastikan hanya yang punya config relation (aman kalau ada field RELATION lama tanpa config)
  return fields.filter((f) => !!f.relation);
}

/**
 * Ambil link relasi secara bulk untuk sekumpulan entries & fields.
 *
 * Skema link:
 * - ContentRelation:
 *    { workspaceId, fieldId,         fromEntryId, toEntryId, position }
 * - ContentRelationM2M:
 *    { workspaceId, relationFieldId, fromEntryId, toEntryId, position }
 */
async function fetchRelationLinksBulk({
  workspaceId = null,
  fromEntryIds,
  relationFields,
}) {
  if (!relationFields?.length || !fromEntryIds?.length) {
    return { oneManyLinks: [], m2mLinks: [] };
  }

  const hasM2M = relationFields.some(
    (f) => f.relation?.kind === "MANY_TO_MANY"
  );
  const hasNonM2M = relationFields.some(
    (f) => f.relation?.kind !== "MANY_TO_MANY"
  );

  let oneManyLinks = [];
  let m2mLinks = [];

  if (hasNonM2M) {
    const nonM2MFieldIds = relationFields
      .filter((f) => f.relation?.kind !== "MANY_TO_MANY")
      .map((f) => f.id);

    if (nonM2MFieldIds.length) {
      oneManyLinks = await prisma.contentRelation.findMany({
        where: {
          fromEntryId: { in: fromEntryIds },
          fieldId: { in: nonM2MFieldIds },
          ...(workspaceId ? { workspaceId } : {}),
        },
        // sertakan position untuk ordering
        select: {
          fromEntryId: true,
          fieldId: true,
          toEntryId: true,
          position: true,
        },
      });
    }
  }

  if (hasM2M) {
    const m2mFieldIds = relationFields
      .filter((f) => f.relation?.kind === "MANY_TO_MANY")
      .map((f) => f.id);

    if (m2mFieldIds.length) {
      m2mLinks = await prisma.contentRelationM2M.findMany({
        where: {
          fromEntryId: { in: fromEntryIds },
          relationFieldId: { in: m2mFieldIds },
          ...(workspaceId ? { workspaceId } : {}),
        },
        // sertakan position untuk ordering
        select: {
          fromEntryId: true,
          relationFieldId: true,
          toEntryId: true,
          position: true,
        },
      });
    }
  }

  return { oneManyLinks, m2mLinks };
}

/**
 * Ambil ringkasan entry target.
 *
 * mode:
 *  - "basic" => subset ringkas:
 *      { id, slug, seoTitle, metaDescription, publishedAt, contentTypeId }
 *  - "full"  => include values (otomatis dapat semua kolom; lebih berat)
 *
 * scope:
 *  - "public" => hanya isPublished = true
 *  - "admin"  => abaikan filter isPublished (bisa lihat draft)
 */
async function fetchEntrySummaries({
  entryIds,
  mode = "basic",
  scope = "public",
}) {
  if (!entryIds || entryIds.length === 0) return [];

  const includeValues = mode === "full";

  const where = {
    id: { in: entryIds },
    ...(scope === "public" ? { isPublished: true } : {}),
  };

  return prisma.contentEntry.findMany({
    where,
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
          contentTypeId: true, // penting untuk depth > 1 tanpa query tambahan
        },
  });
}

/**
 * Expand relasi utk depth 1.
 *
 * Hasil:
 *  - out: Map<entryId, { [fieldApiKey]: object | object[] }>
 *  - targetContainers: Map<targetEntryId, object[]> → semua referensi
 *    ke object target di dalam out (dipakai utk depth > 1).
 */
async function expandRelationsDepth1({
  workspaceId = null,
  entries,
  relationFields,
  mode = "basic",
  allowedFieldApiKeys = null, // Set([...]) atau null
  scope = "public",
}) {
  const out = new Map(entries.map((e) => [e.id, {}]));
  const targetContainers = new Map(); // targetId -> array of object references

  if (!relationFields?.length || !entries?.length) {
    return { out, targetContainers };
  }

  // Filter field berdasar whitelist API key bila ada
  const filtered = relationFields.filter(
    (f) => !allowedFieldApiKeys || allowedFieldApiKeys.has(f.apiKey)
  );
  if (filtered.length === 0) return { out, targetContainers };

  const fromEntryIds = entries.map((e) => e.id);

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
    mode,
    scope,
  });

  const targetById = new Map(targets.map((t) => [t.id, t]));

  // Buat index fieldId -> field meta (untuk baca kind & apiKey)
  const fieldMetaById = new Map(filtered.map((f) => [f.id, f]));

  // Helper: register referensi ke target object utk depth > 1
  function registerTargetContainer(target) {
    if (!target || !target.id) return;
    if (!targetContainers.has(target.id)) {
      targetContainers.set(target.id, []);
    }
    targetContainers.get(target.id).push(target);
  }

  // ==== HORMATI ORDER BY POSITION ====

  // Group ONE/MANY (non-M2M) per fromEntryId+fieldId
  const groupedOneMany = new Map(); // key: `${fromEntryId}::${fieldId}` -> links[]
  for (const l of oneManyLinks) {
    const key = `${l.fromEntryId}::${l.fieldId}`;
    if (!groupedOneMany.has(key)) groupedOneMany.set(key, []);
    groupedOneMany.get(key).push(l);
  }
  // Sort tiap group by position
  for (const [, arr] of groupedOneMany) {
    arr.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  // Group M2M per fromEntryId+relationFieldId
  const groupedM2M = new Map(); // key: `${fromEntryId}::${relationFieldId}` -> links[]
  for (const l of m2mLinks) {
    const key = `${l.fromEntryId}::${l.relationFieldId}`;
    if (!groupedM2M.has(key)) groupedM2M.set(key, []);
    groupedM2M.get(key).push(l);
  }
  for (const [, arr] of groupedM2M) {
    arr.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  // Isikan hasil utk ContentRelation (ONE/MANY-TO-ONE/MANY) sesuai urutan
  for (const [, links] of groupedOneMany) {
    for (const link of links) {
      const bucket = out.get(link.fromEntryId);
      if (!bucket) continue;

      const meta = fieldMetaById.get(link.fieldId);
      if (!meta) continue;

      const target = targetById.get(link.toEntryId);
      if (!target) continue;

      const kind = meta.relation?.kind;
      const apiKey = meta.apiKey;

      // Single vs multi berdasarkan kind
      if (kind === "ONE_TO_ONE" || kind === "MANY_TO_ONE") {
        // Single: ambil yang posisi terkecil (karena sudah di-sort)
        if (bucket[apiKey] == null) {
          bucket[apiKey] = target;
          registerTargetContainer(target);
        }
      } else if (kind === "ONE_TO_MANY") {
        // Multi: array terurut
        if (!Array.isArray(bucket[apiKey])) bucket[apiKey] = [];
        if (!bucket[apiKey].some((v) => v.id === target.id)) {
          bucket[apiKey].push(target);
          registerTargetContainer(target);
        }
      } else {
        // fallback aman: array
        if (!Array.isArray(bucket[apiKey])) bucket[apiKey] = [];
        if (!bucket[apiKey].some((v) => v.id === target.id)) {
          bucket[apiKey].push(target);
          registerTargetContainer(target);
        }
      }
    }
  }

  // Isikan hasil utk ContentRelationM2M (selalu multi) sesuai urutan
  for (const [, links] of groupedM2M) {
    for (const link of links) {
      const bucket = out.get(link.fromEntryId);
      if (!bucket) continue;

      const meta = fieldMetaById.get(link.relationFieldId);
      if (!meta) continue;

      const target = targetById.get(link.toEntryId);
      if (!target) continue;

      const apiKey = meta.apiKey;

      if (!Array.isArray(bucket[apiKey])) bucket[apiKey] = [];
      if (!bucket[apiKey].some((v) => v.id === target.id)) {
        bucket[apiKey].push(target);
        registerTargetContainer(target);
      }
    }
  }

  return { out, targetContainers };
}

/**
 * API utama untuk ekspansi relasi.
 *
 * Params:
 *  - workspaceId        : string | null
 *  - entries            : ContentEntry[] (hasil findMany / findFirst)
 *  - contentTypeId      : ContentType.id untuk membaca daftar field RELATION (root)
 *  - depth              : kedalaman ekspansi, default 1
 *  - maxDepth           : batas maksimal depth (default 5)
 *  - mode               : "basic" | "full"
 *                         * basic -> target relasi ringkas (id, slug, seoTitle, metaDescription, publishedAt, contentTypeId)
 *                         * full  -> target relasi include values (lebih berat)
 *  - scope              : "public" | "admin"
 *                         * public -> hanya target isPublished = true
 *                         * admin  -> semua target (include draft)
 *  - allowedFieldApiKeys: Set<string> | null (whitelist field RELATION di level root)
 *                         * null -> semua RELATION field di-include
 *
 * Behaviour:
 *  - depth akan di-clamp ke [0..maxDepth]
 *  - depth === 0 -> tidak ada ekspansi (_relations kosong)
 *  - depth >= 1  -> relasi level 1 diisi,
 *                  depth > 1 -> target akan punya `_relations` lagi (rekursif)
 *
 * Return:
 *  - Map<entryId, { [fieldApiKey]: object | object[] }>
 *
 * Untuk depth > 1:
 *  - Setiap object target bisa punya properti:
 *      _relations: { [fieldApiKey]: object | object[] }
 */
export async function expandRelations({
  workspaceId = null,
  entries,
  contentTypeId,
  depth = 1,
  maxDepth = 5,
  mode, // "basic" | "full"
  summary, // legacy name, kalau masih dipakai caller lama
  scope = "public",
  allowedFieldApiKeys = null,
} = {}) {
  if (!entries || entries.length === 0) return new Map();

  // mode efektif: pakai mode kalau ada, kalau tidak pakai summary (backward compat),
  // default ke "basic"
  const effectiveMode = mode || summary || "basic";

  // Clamp depth ke [0..maxDepth]
  const depthRaw = Number(depth ?? 1);
  const safeDepth = Number.isFinite(depthRaw)
    ? Math.min(Math.max(depthRaw, 0), maxDepth)
    : 1;

  // Kalau depth 0 → tidak expand relasi sama sekali
  if (safeDepth === 0) {
    return new Map(entries.map((e) => [e.id, {}]));
  }

  // Ambil field RELATION untuk CT root
  const relationFields = await getRelationFields({ contentTypeId });

  // LEVEL 1
  const { out: level1, targetContainers } = await expandRelationsDepth1({
    workspaceId,
    entries,
    relationFields,
    mode: effectiveMode,
    allowedFieldApiKeys,
    scope,
  });

  // Kalau cuma depth=1, atau tidak ada target relasi, selesai
  if (safeDepth <= 1 || targetContainers.size === 0) {
    return level1;
  }

  // ==== DEPTH > 1 (PAKAI contentTypeId DARI TARGET YANG SUDAH DI-FETCH) ====
  // Kumpulkan per contentTypeId tanpa query tambahan ke DB
  const byContentType = new Map(); // contentTypeId -> [{ id }]
  for (const [entryId, containers] of targetContainers.entries()) {
    const anyObj = containers && containers[0];
    if (!anyObj || !anyObj.contentTypeId) continue;
    const ctId = anyObj.contentTypeId;
    if (!byContentType.has(ctId)) {
      byContentType.set(ctId, []);
    }
    byContentType.get(ctId).push({ id: entryId });
  }

  // Rekursif: expand utk setiap kelompok contentType target
  for (const [ctId, ctEntries] of byContentType.entries()) {
    const childMap = await expandRelations({
      workspaceId,
      entries: ctEntries,
      contentTypeId: ctId,
      depth: safeDepth - 1,
      maxDepth,
      mode: effectiveMode,
      scope,
      // di level dalam, semua field RELATION boleh
      allowedFieldApiKeys: null,
    });

    // Tempel hasil ke setiap object target yg merefer ke entryId tsb
    for (const [entryId, relObject] of childMap.entries()) {
      const containers = targetContainers.get(entryId);
      if (!containers || !relObject) continue;

      for (const obj of containers) {
        obj._relations = {
          ...(obj._relations || {}),
          ...relObject,
        };
      }
    }
  }

  return level1;
}

export default {
  expandRelations,
};
