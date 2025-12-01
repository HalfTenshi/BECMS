// =========================================================
// src/middlewares/enforceSeoEnabled.js
// =========================================================

import prisma from "../config/prismaClient.js";
import { ApiError } from "../utils/ApiError.js";
import { ERROR_CODES } from "../constants/errorCodes.js";

/**
 * Middleware optional untuk membuang SEO fields dari req.body
 * jika ContentType.seoEnabled = false.
 *
 * Bisa dipasang di route admin, misalnya:
 *
 *   router.post(
 *     "/:contentType/entries",
 *     auth,
 *     workspaceContext,
 *     enforceSeoEnabled,
 *     contentEntryController.create
 *   );
 *
 * Asumsi:
 *  - workspaceId tersedia di req.workspaceId atau req.workspace.id
 *  - contentTypeId tersedia di req.body.contentTypeId
 *    ATAU contentType apiKey di req.params.contentType (opsional)
 *
 * Jika tidak bisa resolve ContentType, middleware akan `next()` saja
 * tanpa mengubah body (tidak mem-blok request).
 */
export async function enforceSeoEnabled(req, res, next) {
  try {
    const workspaceId = req.workspaceId || req.workspace?.id;
    if (!workspaceId) {
      // Tidak tahu workspace → jangan utak-atik body, serahkan ke handler lain
      return next();
    }

    let { contentTypeId } = req.body || {};

    // Optional: kalau pakai pattern route /:contentType/entries
    // dan body tidak mengirim contentTypeId, middleware bisa resolve
    // dari apiKey di URL.
    if (!contentTypeId && req.params?.contentType) {
      const ctByApiKey = await prisma.contentType.findFirst({
        where: {
          workspaceId,
          apiKey: req.params.contentType,
        },
        select: { id: true, seoEnabled: true },
      });

      if (!ctByApiKey) {
        // Biarkan service yang melempar error "ContentType not found"
        return next();
      }

      contentTypeId = ctByApiKey.id;

      // Jika sudah diketahui seoEnabled = false di sini, langsung strip
      if (ctByApiKey.seoEnabled === false && req.body) {
        delete req.body.seoTitle;
        delete req.body.metaDescription;
        delete req.body.keywords;
      }

      return next();
    }

    if (!contentTypeId) {
      // Tidak ada info ContentType → tidak bisa enforce
      return next();
    }

    const ct = await prisma.contentType.findFirst({
      where: {
        id: contentTypeId,
        workspaceId,
      },
      select: { id: true, seoEnabled: true },
    });

    if (!ct) {
      // Biarkan service yang melempar error jika perlu
      return next();
    }

    if (ct.seoEnabled === false && req.body) {
      // 🔐 Strip SEO fields dari body, biar tidak pernah tersimpan
      delete req.body.seoTitle;
      delete req.body.metaDescription;
      delete req.body.keywords;
    }

    return next();
  } catch (err) {
    // Kalau sudah ApiError, lempar apa adanya
    if (err instanceof ApiError) {
      return next(err);
    }

    // Kalau ada error di middleware ini, jangan bikin 500 yang "aneh";
    // bungkus rapi sebagai 500 dengan kode VALIDATION_ERROR (karena
    // konteksnya SEO config / validation).
    return next(
      ApiError.internal("Failed to enforce SEO configuration", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "SEO_ENFORCE_FAILED",
        details: { originalError: err.message },
      })
    );
  }
}

export default enforceSeoEnabled;