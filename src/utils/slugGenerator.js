// src/utils/slugGenerator.js

export function generateSlug(text, opts = {}) {
  const { maxLength = 190, fallback = "entry" } = opts;

  if (!text || !String(text).trim()) return fallback;

  let slug = text
    .toString()
    .normalize("NFKD")                 // buang accent
    .replace(/[\u0300-\u036f]/g, "")   // remove diacritic marks
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")          // buang karakter non-alfanumerik
    .replace(/\s+/g, "-")              // spasi → -
    .replace(/-+/g, "-")               // -- → -
    .replace(/^-+|-+$/g, "");          // trim - di awal/akhir

  if (!slug) slug = fallback;
  if (slug.length > maxLength) slug = slug.slice(0, maxLength);

  return slug;
}
