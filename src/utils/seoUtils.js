// src/utils/seoUtils.js

/**
 * Normalize SEO-related fields supaya konsisten di seluruh sistem.
 *
 * - metaDescription:
 *    - jika string → trim
 *    - dipotong max 160 karakter (best practice SERP)
 * - keywords:
 *    - jika string "a,b,c" → di-split by "," → trim → filter kosong
 *    - jika bukan array/string → fallback ke []
 */
export function normalizeSeoFields(data = {}) {
  const out = { ...data };

  // metaDescription max 160 chars
  if (typeof out.metaDescription === "string") {
    const trimmed = out.metaDescription.trim();
    out.metaDescription =
      trimmed.length > 160 ? trimmed.slice(0, 160) : trimmed;
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
 * (Optional) Hints panjang SEO buat FE jika mau dipakai di API metadata.
 * Tidak dipakai langsung di BE, tapi bisa di-expose lewat endpoint config.
 */
export function getSeoLengthHints() {
  return {
    title: {
      recommendedMax: 60,    // karakter
    },
    metaDescription: {
      recommendedMax: 160,   // karakter
    },
  };
}
