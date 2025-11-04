import prisma from "../config/prismaClient.js";
import { ENABLE_DENORM } from "../config/featureFlags.js";

// helper: ambil nilai string dari target entry sesuai config.from
async function _readSourceStringFromTarget({ targetEntry, from }) {
  if (!from || from === "seoTitle") {
    return targetEntry.seoTitle || targetEntry.slug || targetEntry.id;
  }
  if (from.startsWith("field:")) {
    const apiKey = from.split(":")[1];
    if (!apiKey) return targetEntry.seoTitle || targetEntry.slug || targetEntry.id;
    const field = await prisma.contentField.findFirst({
      where: { contentTypeId: targetEntry.contentTypeId, apiKey },
      select: { id: true },
    });
    if (!field) return targetEntry.seoTitle || targetEntry.slug || targetEntry.id;
    const val = await prisma.fieldValue.findUnique({
      where: { entryId_fieldId: { entryId: targetEntry.id, fieldId: field.id } },
      select: { valueString: true, valueNumber: true, valueBoolean: true, valueDate: true, valueJson: true },
    });
    if (!val) return targetEntry.seoTitle || targetEntry.slug || targetEntry.id;
    // render singkat jadi string
    if (val.valueString != null) return String(val.valueString);
    if (val.valueNumber != null) return String(val.valueNumber);
    if (val.valueBoolean != null) return val.valueBoolean ? "true" : "false";
    if (val.valueDate != null) return new Date(val.valueDate).toISOString();
    if (val.valueJson != null) return JSON.stringify(val.valueJson);
    return targetEntry.seoTitle || targetEntry.slug || targetEntry.id;
  }
  // fallback
  return targetEntry.seoTitle || targetEntry.slug || targetEntry.id;
}

async function _upsertStringValue({ entryId, fieldApiKey, contentTypeId, value }) {
  // cari fieldId dari apiKey pada CT sumber
  const field = await prisma.contentField.findFirst({
    where: { contentTypeId, apiKey: fieldApiKey },
    select: { id: true },
  });
  if (!field) return; // silent: tidak ada field target → tidak denorm

  // hapus value lama & isi baru
  await prisma.fieldValue.deleteMany({ where: { entryId, fieldId: field.id } });
  await prisma.fieldValue.create({
    data: {
      entryId,
      fieldId: field.id,
      valueString: value ?? null,
    },
  });
}

/**
 * Recompute denormalisasi untuk sekumpulan entry sumber (fromEntryIds) pada satu relation field.
 * Membaca config dari ContentField.config.denorm.
 */
export async function recomputeDenormForRelationField({ workspaceId, relationFieldId, fromEntryIds }) {
  if (!ENABLE_DENORM) return;

  const relField = await prisma.contentField.findUnique({
    where: { id: relationFieldId },
    select: { id: true, contentTypeId: true, config: true },
  });
  if (!relField) return;

  let cfg = {};
  try {
    cfg = typeof relField.config === "object" ? relField.config : JSON.parse(relField.config || "{}");
  } catch (_) {}
  const den = cfg.denorm;
  if (!den || !den.targetFieldApiKey) return; // tidak ada konfigurasi denorm

  const joinWith = den.joinWith ?? ", ";
  const fromSpec = den.from ?? "seoTitle";

  // Ambil semua pasangan relasi (1..N & M2M) untuk fromEntryIds pada field ini
  const [pairs1N, pairsM2M] = await prisma.$transaction([
    prisma.contentRelation.findMany({
      where: { workspaceId, fieldId: relationFieldId, fromEntryId: { in: fromEntryIds } },
      select: { fromEntryId: true, toEntryId: true },
    }),
    prisma.contentRelationM2M.findMany({
      where: { workspaceId, relationFieldId, fromEntryId: { in: fromEntryIds } },
      select: { fromEntryId: true, toEntryId: true },
    }),
  ]);

  // group: fromEntryId -> Set(toEntryIds)
  const group = new Map();
  for (const p of [...pairs1N, ...pairsM2M]) {
    const arr = group.get(p.fromEntryId) || new Set();
    arr.add(p.toEntryId);
    group.set(p.fromEntryId, arr);
  }

  // Ambil semua target yg terlibat
  const allTargetIds = [...new Set([].concat(...[...group.values()].map(s => [...s])))];
  const targets = allTargetIds.length
    ? await prisma.contentEntry.findMany({
        where: { id: { in: allTargetIds } },
        select: { id: true, contentTypeId: true, slug: true, seoTitle: true, isPublished: true, publishedAt: true },
      })
    : [];
  const tmap = Object.fromEntries(targets.map(t => [t.id, t]));

  // Hitung dan tulis nilai string denorm per fromEntry
  for (const [fromId, toSet] of group.entries()) {
    const toIds = [...toSet];
    const vals = [];
    for (const tid of toIds) {
      const target = tmap[tid];
      if (!target) continue;
      // baca string dari target sesuai spec
      // eslint-disable-next-line no-await-in-loop
      const s = await _readSourceStringFromTarget({ targetEntry: target, from: fromSpec });
      if (s) vals.push(s);
    }
    const value = vals.join(joinWith);
    // cari CT sumber
    const src = await prisma.contentEntry.findUnique({
      where: { id: fromId },
      select: { contentTypeId: true },
    });
    if (!src) continue;
    // tulis ke field TEXT sumber
    // eslint-disable-next-line no-await-in-loop
    await _upsertStringValue({
      entryId: fromId,
      fieldApiKey: den.targetFieldApiKey,
      contentTypeId: src.contentTypeId,
      value,
    });
  }
}

/**
 * Recompute akibat target entry berubah:
 * - cari semua relation field yang menunjuk ke contentType target
 * - temukan semua fromEntry yang terhubung ke targetEntryId tsb
 * - panggil recomputeDenormForRelationField per field
 */
export async function recomputeDenormForTargetChange({ workspaceId, targetEntryId }) {
  if (!ENABLE_DENORM) return;
  // cari semua pasangan relasi yg mengarah ke targetEntryId
  const [pairs1N, pairsM2M] = await prisma.$transaction([
    prisma.contentRelation.findMany({
      where: { workspaceId, toEntryId: targetEntryId },
      select: { fieldId: true, fromEntryId: true },
    }),
    prisma.contentRelationM2M.findMany({
      where: { workspaceId, toEntryId: targetEntryId },
      select: { relationFieldId: true, fromEntryId: true },
    }),
  ]);

  // fieldId -> fromEntryIds[]
  const fieldMap = new Map();
  for (const p of pairs1N) {
    const k = p.fieldId;
    const arr = fieldMap.get(k) || new Set();
    arr.add(p.fromEntryId);
    fieldMap.set(k, arr);
  }
  for (const p of pairsM2M) {
    const k = p.relationFieldId;
    const arr = fieldMap.get(k) || new Set();
    arr.add(p.fromEntryId);
    fieldMap.set(k, arr);
  }

  for (const [fieldId, set] of fieldMap.entries()) {
    await recomputeDenormForRelationField({
      workspaceId,
      relationFieldId: fieldId,
      fromEntryIds: [...set],
    });
  }
}
