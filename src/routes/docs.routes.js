// src/routes/docs.routes.js
import express from "express";
import docsService from "../modules/docs/docs.service.js";

const router = express.Router();

/**
 * GET /api/docs/openapi.json
 *
 * OpenAPI 3.1 spec untuk public Content API.
 * Termasuk:
 *  - GET /api/public/content/:contentType
 *  - GET /api/public/content/:contentType/:slug
 *
 * Di dalamnya sudah terdokumentasi:
 *  - Query params SEO & listing (q, page, pageSize, sort, include)
 *  - Query params relasi:
 *      - relations           : boolean / string
 *      - relationsDepth      : integer 1..5 (di-clamp)
 *      - relationsSummary    : "basic" | "full"
 */
router.get("/openapi.json", async (req, res, next) => {
  try {
    const spec = await docsService.buildOpenAPISpec();
    res.json(spec);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/docs/content/:apiKey.json
 *
 * Dokumentasi untuk satu ContentType:
 *  - schema entry (JSON Schema)
 *  - contoh payload
 *  - endpoint public:
 *      - list  : /api/public/content/:apiKey
 *      - detail: /api/public/content/:apiKey/:slug
 *
 * Termasuk penjelasan singkat tentang query params relasi
 * (relations, relationsDepth, relationsSummary) di field "endpoints".
 */
);

router.get("/content/:apiKey.json", async (req, res, next) => {
  try {
    const doc = await docsService.buildContentTypeDoc(req.params.apiKey);
    res.json(doc);
  } catch (e) {
    next(e);
  }
});

export default router;
