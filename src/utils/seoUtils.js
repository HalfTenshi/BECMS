// src/utils/seoUtils.js

/**
 * Panjang maksimal SEO berdasarkan praktik umum SERP.
 * Dipakai di BE (validation) & boleh diekspos ke FE.
 */
export const MAX_SEO_TITLE_LENGTH = 60;
export const MAX_META_DESCRIPTION_LENGTH = 160;

/**
 * Normalize SEO-related fields supaya konsisten di seluruh sistem.
 *
 * Catatan penting:
 * - ❌ TIDAK lagi memotong metaDescription di sini.
 *   Pembatasan panjang dilakukan di service sebagai business rule (422).
 *
 * - metaDescription:
 *    - jika string → trim
 * - seoTitle:
 *    - jika string → trim
 * - keywords:
 *    - jika string "a,b,c" → di-split by "," → trim → filter kosong
 *    - jika bukan array/string → fallback ke []
 */
export function normalizeSeoFields(data = {}) {
  const out = { ...data };

  // seoTitle: trim saja (batas panjang dicek di service)
  if (typeof out.seoTitle === "string") {
    const trimmed = out.seoTitle.trim();
    out.seoTitle = trimmed.length > 0 ? trimmed : null;
  }

  // metaDescription: trim saja (batas 160 chars dicek di service)
  if (typeof out.metaDescription === "string") {
    const trimmed = out.metaDescription.trim();
    out.metaDescription = trimmed.length > 0 ? trimmed : null;
  }

  // keywords: allow "a,b,c" or ["a","b","c"]
  if (typeof out.keywords === "string") {
    out.keywords = out.keywords
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(out.keywords)) {
    out.keywords = [];
  }

  return out;
}

/**
 * Strip semua SEO fields dari payload.
 * Dipakai ketika:
 *  - ContentType.seoEnabled = false
 *  - Atau mau hard-reset SEO pada entry.
 */
export function stripSeoFields(data = {}) {
  const out = { ...data };
  out.seoTitle = null;
  out.metaDescription = null;
  out.keywords = [];
  return out;
}

/**
 * Helper kecil buat ngecek flag seoEnabled dari ContentType.
 * Di sini cuma jaga supaya kalau null/undefined dianggap tidak enabled.
 */
export function isSeoEnabledForContentType(contentType) {
  if (!contentType) return false;
  return !!contentType.seoEnabled;
}

/**
 * Hints panjang SEO buat FE jika mau dipakai di API metadata.
 * Tidak dipakai langsung di BE, tapi bisa di-expose lewat endpoint config.
 */
export function getSeoLengthHints() {
  return {
    title: {
      recommendedMax: MAX_SEO_TITLE_LENGTH, // karakter
    },
    metaDescription: {
      recommendedMax: MAX_META_DESCRIPTION_LENGTH, // karakter
    },
  };
}
