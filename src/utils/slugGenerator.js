// src/utils/slugGenerator.js

/**
 * Generate SEO-friendly slug dari sebuah text.
 *
 * Karakteristik:
 * - Lowercase
 * - Menghapus accent/diacritic (é → e, ü → u, dll)
 * - Hanya huruf, angka, underscore, dan dash
 * - Spasi → "-"
 * - Multiple dash dirapikan menjadi satu
 * - Trim dash di awal/akhir
 * - Panjang dibatasi (default 190 char, aman untuk DB column & URL)
 *
 * @param {string} text - Teks sumber untuk slug (misalnya title atau nama entry)
 * @param {Object} opts
 * @param {number} [opts.maxLength=190] - Batas maksimal panjang slug
 * @param {string} [opts.fallback="entry"] - Nilai fallback jika text kosong/tidak valid
 * @returns {string} slug yang sudah dinormalisasi
 */
export function generateSlug(text, opts = {}) {
  const { maxLength = 190, fallback = "entry" } = opts;

  if (!text || !String(text).trim()) return fallback;

  let slug = text
    .toString()
    .normalize("NFKD")                 // buang accent
    .replace(/[\u0300-\u036f]/g, "")   // remove diacritic marks
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")          // buang karakter non-alfanumerik (kecuali underscore & dash)
    .replace(/\s+/g, "-")              // spasi → -
    .replace(/-+/g, "-")               // -- → -
    .replace(/^-+|-+$/g, "");          // trim - di awal/akhir

  if (!slug) slug = fallback;
  if (slug.length > maxLength) slug = slug.slice(0, maxLength);

  return slug;
}
