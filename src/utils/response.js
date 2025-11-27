// src/utils/response.js

/**
 * Helper standar response JSON.
 *
 * - success: boolean flag supaya FE mudah ngecek
 * - data   : payload utama
 * - meta   : optional metadata (pagination, warnings, dsb)
 *
 * Untuk SEO warnings / hints, cukup kirim di meta.warnings, contoh:
 *   ok(res, data, { warnings: [{ code: "SEO_TITLE_TOO_LONG", message: "..." }] })
 */
export function ok(res, data, meta) {
  return res.status(200).json({
    success: true,
    data,
    meta: meta || undefined,
  });
}

export function created(res, data, meta) {
  return res.status(201).json({
    success: true,
    data,
    meta: meta || undefined,
  });
}

export function noContent(res) {
  return res.status(204).send(); // tidak ada body
}
