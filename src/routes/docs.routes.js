// src/routes/docs.routes.js
import express from "express";
import docsService from "../modules/docs/docs.service.js";

const router = express.Router();

/**
 * GET /api/docs/openapi.json
 * OpenAPI 3.1 spec untuk semua content type yang tersedia
 */
router.get("/openapi.json", async (req, res, next) => {
  try {
    const spec = await docsService.buildOpenAPISpec();
    res.json(spec);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/docs/content/:apiKey.json
 * Dokumentasi (schema + contoh + endpoint) untuk satu ContentType
 */
router.get("/content/:apiKey.json", async (req, res, next) => {
  try {
    const doc = await docsService.buildContentTypeDoc(req.params.apiKey);
    res.json(doc);
  } catch (e) {
    next(e);
  }
});

export default router;
