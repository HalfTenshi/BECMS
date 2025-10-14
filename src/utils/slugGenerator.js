// src/utils/slugGenerator.js

export function generateSlug(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")       // ubah spasi jadi tanda minus
    .replace(/[^\w\-]+/g, "")   // hapus karakter non-alfanumerik
    .replace(/\-\-+/g, "-");    // hapus tanda minus ganda
}
