// src/routes/seo.routes.js
import express from "express";
import { body, query } from "express-validator";

import { validate } from "../middlewares/validate.js";
import { auth } from "../middlewares/auth.js";
import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";

import seoSupportController from "../modules/seo/seoSupport.controller.js";
import contentEntryRepository from "../modules/content/contentEntry.repository.js";
import {
  MAX_SEO_TITLE_LENGTH,
  MAX_META_DESCRIPTION_LENGTH,
} from "../utils/seoUtils.js";
import { ApiError } from "../utils/ApiError.js";
import { ERROR_CODES } from "../constants/errorCodes.js";

const router = express.Router();

/**
 * POST /api/seo/analyze
 *
 * Body:
 *  - title?: string
 *  - description?: string
 *  - slug?: string
 *  - content?: string
 *  - focusKeyword?: string
 *
 * Response:
 *  {
 *    ok: true,
 *    result: {
 *      title: { length, max, status, value },
 *      description: { length, max, status, value },
 *      keyword: { value, inTitle, inDescription, inSlug, densityPercent },
 *      score: { overall, breakdown: { ... } }
 *    }
 *  }
 *
 * Catatan:
 *  - Endpoint ini boleh tetap PUBLIC (tanpa auth) sebagai SEO helper umum.
 */
const analyzeRules = [
  body("title")
    .optional()
    .isString()
    .withMessage("title must be a string"),
  body("description")
    .optional()
    .isString()
    .withMessage("description must be a string"),
  body("slug")
    .optional()
    .isString()
    .withMessage("slug must be a string"),
  body("content")
    .optional()
    .isString()
    .withMessage("content must be a string"),
  body("focusKeyword")
    .optional()
    .isString()
    .withMessage("focusKeyword must be a string"),
];

router.post(
  "/analyze",
  analyzeRules,
  validate,
  (req, res, next) => seoSupportController.analyze(req, res, next)
);

/**
 * GET /api/seo/preview?entryId=...
 *
 * Tujuan:
 *  - Mengembalikan data yang siap dipakai FE untuk SERP preview:
 *    - titleForSerp (fallback: seoTitle → slug)
 *    - descriptionForSerp (fallback: metaDescription → null)
 *    - urlPath (sementara: "/{slug}")
 *    - panjang title/description + max length (60/160)
 *
 * Proteksi:
 *  - auth + workspaceContext (multi-tenant safe)
 *  - authorize(ACTIONS.READ, RESOURCES.CONTENT_SEO)
 */
const previewRules = [
  query("entryId")
    .isString()
    .notEmpty()
    .withMessage("entryId is required"),
];

router.get(
  "/preview",
  auth,
  workspaceContext,
  authorize(ACTIONS.READ, RESOURCES.CONTENT_SEO),
  previewRules,
  validate,
  async (req, res, next) => {
    try {
      const workspaceId =
        req.workspace?.id || req.ctx?.workspaceId || req.headers["x-workspace-id"];
      const { entryId } = req.query;

      if (!workspaceId) {
        throw new ApiError(400, "workspaceId is required", {
          code: ERROR_CODES.WORKSPACE_REQUIRED,
          resource: "CONTENT_SEO",
        });
      }

      const entry = await contentEntryRepository.findSeoById(
        String(entryId),
        String(workspaceId)
      );

      if (!entry) {
        throw new ApiError(404, "Entry not found", {
          code: ERROR_CODES.CONTENT_ENTRY_NOT_FOUND,
          resource: "CONTENT_ENTRIES",
          details: { entryId, workspaceId },
        });
      }

      const rawTitle = entry.seoTitle || null;
      const rawDescription = entry.metaDescription || null;

      const titleForSerp = rawTitle || entry.slug || null;
      const descriptionForSerp = rawDescription || null;

      const titleLength = titleForSerp ? titleForSerp.length : 0;
      const descriptionLength = descriptionForSerp
        ? descriptionForSerp.length
        : 0;

      // Sederhana: FE bisa membangun full URL dari slug & workspace config sendiri.
      const urlPath = entry.slug ? `/${entry.slug}` : null;

      return res.json({
        ok: true,
        preview: {
          id: entry.id,
          workspaceId: entry.workspaceId,
          contentTypeId: entry.contentTypeId,
          slug: entry.slug,
          isPublished: entry.isPublished,
          publishedAt: entry.publishedAt,
          urlPath,

          title: {
            value: titleForSerp,
            length: titleLength,
            max: MAX_SEO_TITLE_LENGTH,
          },
          description: {
            value: descriptionForSerp,
            length: descriptionLength,
            max: MAX_META_DESCRIPTION_LENGTH,
          },

          seoRaw: {
            seoTitle: rawTitle,
            metaDescription: rawDescription,
            keywords: entry.keywords || [],
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
