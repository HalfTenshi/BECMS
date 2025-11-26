// src/modules/content/entry.validation.js
import prisma from "../../config/prismaClient.js";

// Mapping kolom nilai di FieldValue per tipe
const TYPE_TO_VALUE_KEY = {
  TEXT: "valueString",
  RICH_TEXT: "valueString",
  NUMBER: "valueNumber",
  BOOLEAN: "valueBoolean",
  DATE: "valueDate",
  JSON: "valueJson",
  SLUG: "valueString",
  RELATION: null, // relasi disimpan di ContentRelation, bukan FieldValue
  MEDIA: "valueJson", // ⬅️ MEDIA simpan JSON: { urls: [...] }
};

export function pickValueKey(type) {
  return TYPE_TO_VALUE_KEY[type] ?? null;
}

// ---------- Helpers ----------
function isNil(v) {
  return v === null || v === undefined;
}
function isEmptyString(v) {
  return typeof v === "string" && v.trim() === "";
}
function toNumber(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return NaN;
}
function ensureArray(v) {
  if (Array.isArray(v)) return v;
  if (isNil(v)) return [];
  return [v];
}

// Cek “ada nilai” yang sensitif tipe
function hasTypedInput(field, raw) {
  const v = raw?.value;
  switch (field.type) {
    case "RELATION": {
      const ids = Array.isArray(v) ? v : isNil(v) ? [] : [v];
      return ids.length > 0 && ids.some((x) => typeof x === "string" && x.trim() !== "");
    }
    case "MEDIA": {
      const urls = Array.isArray(v?.urls) ? v.urls : [];
      return urls.length > 0;
    }
    case "JSON": {
      if (isNil(v)) return false;
      if (typeof v === "object") return Object.keys(v).length > 0;
      // terima string JSON juga
      return String(v).trim() !== "";
    }
    default: {
      return v !== undefined && v !== null && v !== "";
    }
  }
}

// Validasi spesifik MEDIA (tanpa modul Media Asset Management penuh)
function validateMedia(field, value) {
  const errors = [];
  const config = field.config || {};
  const {
    acceptMimeTypes = ["image/png", "image/jpeg", "image/webp"],
    maxFiles = 1,
    minFiles = 0,
    maxSizeMB,
  } = config;

  const urls = Array.isArray(value?.urls) ? value.urls : [];
  if (field.isRequired && urls.length === 0) {
    errors.push(`Field "${field.apiKey}" is required`);
    return { errors };
  }

  if (urls.length < minFiles)
    errors.push(`"${field.apiKey}" requires at least ${minFiles} file(s)`);
  if (urls.length > maxFiles)
    errors.push(`"${field.apiKey}" exceeds maxFiles=${maxFiles}`);

  for (const u of urls) {
    if (typeof u !== "string" || !u.startsWith("/uploads/")) {
      errors.push(`"${field.apiKey}" invalid file url: ${u}`);
    }
  }

  // validasi metadata opsional
  if (Array.isArray(value?.files)) {
    for (const f of value.files) {
      if (f?.mime && !acceptMimeTypes.includes(f.mime)) {
        errors.push(`"${field.apiKey}" mime not allowed: ${f.mime}`);
      }
      if (typeof maxSizeMB === "number" && typeof f?.size === "number") {
        const limit = maxSizeMB * 1024 * 1024;
        if (f.size > limit)
          errors.push(
            `"${field.apiKey}" file too large (> ${maxSizeMB} MB)`
          );
      }
    }
  }

  // normalisasi untuk penyimpanan/unik: sort urls
  const normalized = { urls: [...urls].sort() };
  if (Array.isArray(value?.files)) {
    // simpan info files bila ada, tidak mengganggu struktur
    normalized.files = value.files;
  }

  return { errors, normalizedJson: normalized };
}

/**
 * enforceOnPayload:
 * - Validasi required/min/max/unique per field
 * - Generate slug bila SLUG tanpa input & ada slugFrom
 * - Kembalikan fieldValues (untuk FieldValue), relations (untuk ContentRelation), generated (slug auto)
 *
 * @param {Object} params
 * @param {string} params.contentTypeId
 * @param {string|null} params.entryId
 * @param {Array<{apiKey:string,value:any}>} params.values
 */
export async function enforceOnPayload({
  contentTypeId,
  entryId, // null saat create, ada saat update
  values, // array: [{ apiKey, value }]
}) {
  // Ambil definisi field untuk CT ini
  const fields = await prisma.contentField.findMany({
    where: { contentTypeId },
    include: { relation: true },
    orderBy: { position: "asc" },
  });

  const byApiKey = Object.fromEntries(fields.map((f) => [f.apiKey, f]));
  const result = { fieldValues: [], relations: [], generated: {} };

  for (const f of fields) {
    const v = values.find((x) => x.apiKey === f.apiKey);
    const hasInput = hasTypedInput(f, v);

    // Required (umum, dengan pengecualian SLUG/RELATION karena diproses khusus)
    if (f.isRequired && !hasInput && f.type !== "SLUG" && f.type !== "RELATION") {
      throw new Error(`Field "${f.apiKey}" is required`);
    }

    // Generate slug from slugFrom & kosong
    if (f.type === "SLUG" && !hasInput) {
      if (f.slugFrom) {
        const src = values.find((x) => x.apiKey === f.slugFrom);
        const srcVal = (src?.value ?? "").toString();
        if (!srcVal) throw new Error(`Slug source "${f.slugFrom}" is empty`);
        const slug = srcVal
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[^\w\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .slice(0, 190);
        result.generated[f.apiKey] = slug;
        result.fieldValues.push({
          fieldId: f.id,
          key: "valueString",
          value: slug,
        });
      }
      continue;
    }

    if (!hasInput) continue; // not required and absent

    // RELATION → disimpan sebagai baris ContentRelation di service/repo
    if (f.type === "RELATION") {
      const ids = Array.isArray(v.value) ? v.value : [v.value];
      // filter id kosong
      const cleanIds = ids.filter(
        (id) => typeof id === "string" && id.trim() !== ""
      );
      if (f.isRequired && cleanIds.length === 0) {
        throw new Error(`Field "${f.apiKey}" is required`);
      }
      // batasi min/maxCount bila ada di config
      if (f?.config?.minCount != null && cleanIds.length < f.config.minCount) {
        throw new Error(
          `Field "${f.apiKey}" requires at least ${f.config.minCount} related item(s)`
        );
      }
      if (f?.config?.maxCount != null && cleanIds.length > f.config.maxCount) {
        throw new Error(
          `Field "${f.apiKey}" exceeds max related item(s): ${f.config.maxCount}`
        );
      }
      result.relations.push({ fieldId: f.id, targetIds: cleanIds });
      continue;
    }

    // MEDIA → lewat validator khusus + simpan normalized JSON
    if (f.type === "MEDIA") {
      const { errors, normalizedJson } = validateMedia(f, v.value);
      if (errors.length) throw new Error(errors.join("; "));
      const key = pickValueKey("MEDIA"); // valueJson
      result.fieldValues.push({
        fieldId: f.id,
        key,
        value: normalizedJson,
      });

      // Unique untuk MEDIA (berbasis JSON)
      if (f.isUnique) {
        const duplicate = await prisma.fieldValue.findFirst({
          where: {
            fieldId: f.id,
            ...(entryId ? { entryId: { not: entryId } } : {}),
            valueJson: normalizedJson, // deep equality
          },
          select: { id: true },
        });
        if (duplicate) throw new Error(`${f.apiKey} must be unique`);
      }
      continue;
    }

    // Tipe biasa (TEXT/RICH_TEXT/NUMBER/BOOLEAN/DATE/JSON/SLUG)
    const key = pickValueKey(f.type);
    if (!key) throw new Error(`Unsupported field type: ${f.type}`);

    // Bounds & length
    if (
      (f.type === "TEXT" || f.type === "RICH_TEXT" || f.type === "SLUG") &&
      typeof v.value === "string"
    ) {
      if (f.minLength != null && v.value.length < f.minLength)
        throw new Error(`${f.apiKey} length < minLength`);
      if (f.maxLength != null && v.value.length > f.maxLength)
        throw new Error(`${f.apiKey} length > maxLength`);
    }
    if (f.type === "NUMBER") {
      const num = Number(v.value);
      if (Number.isNaN(num)) throw new Error(`${f.apiKey} must be a number`);
      if (f.minNumber != null && num < f.minNumber)
        throw new Error(`${f.apiKey} < minNumber`);
      if (f.maxNumber != null && num > f.maxNumber)
        throw new Error(`${f.apiKey} > maxNumber`);
    }
    if (f.type === "DATE" && v.value) {
      const d = new Date(v.value);
      if (isNaN(d.getTime())) throw new Error(`${f.apiKey} must be a valid date`);
    }
    if (f.type === "JSON" && v.value != null && typeof v.value !== "object") {
      // izinkan string JSON, tapi jika bukan object/array dan bukan JSON valid → error
      try {
        JSON.parse(String(v.value));
      } catch {
        throw new Error(
          `${f.apiKey} must be an object/array or valid JSON string`
        );
      }
    }

    // Unique (langsung equality di kolom yang sesuai)
    if (f.isUnique) {
      const whereBase = {
        fieldId: f.id,
        ...(entryId ? { entryId: { not: entryId } } : {}),
      };

      const exist = await prisma.fieldValue.findFirst({
        where: {
          ...whereBase,
          [key]: v.value,
        },
        select: { id: true },
      });
      if (exist) throw new Error(`${f.apiKey} must be unique`);
    }

    result.fieldValues.push({
      fieldId: f.id,
      key,
      value: v.value,
    });
  }

  return result;
}
