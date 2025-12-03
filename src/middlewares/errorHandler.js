// =========================================================
// src/middlewares/errorHandler.js
// =========================================================

import { ApiError } from "../utils/ApiError.js";

/**
 * Global error handler (satu pintu semua error HTTP)
 *
 * Format respons:
 * {
 *   success: false,
 *   error: {
 *     type: "about:blank" | string,
 *     title: string,
 *     status: number,
 *     code?: string,
 *     reason?: string,
 *     action?: string,
 *     resource?: string,
 *     detail: string,
 *     instance: string,      // req.originalUrl
 *     errors?: any           // detail tambahan (mis: dari express-validator atau validator lain)
 *   }
 * }
 *
 * Contoh untuk SEO:
 * 422 + new ApiError(422, "seoTitle must be at most 60 characters", {
 *   code: ERROR_CODES.SEO_TITLE_TOO_LONG,
 *   reason: "SEO_VALIDATION_FAILED",
 * })
 *
 * Akan menghasilkan:
 * {
 *   success: false,
 *   error: {
 *     type: "about:blank",
 *     title: "Unprocessable Entity",
 *     status: 422,
 *     code: "SEO_TITLE_TOO_LONG",
 *     reason: "SEO_VALIDATION_FAILED",
 *     detail: "seoTitle must be at most 60 characters",
 *     instance: "/api/admin/content/entries",
 *     errors: undefined
 *   }
 * }
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // Tentukan status:
  // - Kalau ApiError → pakai err.status (fallback 500)
  // - Kalau lib lain set .status → hormati selama 4xx/5xx
  // - Selain itu → 500
  let status = 500;

  if (err instanceof ApiError && typeof err.status === "number") {
    status =
      err.status >= 400 && err.status <= 599 ? err.status : 500;
  } else if (
    typeof err.status === "number" &&
    err.status >= 400 &&
    err.status <= 599
  ) {
    status = err.status;
  }

  // Title default berdasarkan status (IETF-ish)
  const defaultTitle =
    status === 400
      ? "Bad Request"
      : status === 401
      ? "Unauthorized"
      : status === 403
      ? "Forbidden"
      : status === 404
      ? "Not Found"
      : status === 409
      ? "Conflict"
      : status === 422
      ? "Unprocessable Entity"
      : status >= 500
      ? "Internal Server Error"
      : "Error";

  // Kadang ada lib yang pakai `errors` alih-alih `details`
  const details = err.details ?? err.errors;

  const body = {
    success: false,
    error: {
      type: err.type || "about:blank",
      title: err.title || defaultTitle,
      status,
      code: err.code || undefined,
      // field penting untuk RBAC & observability
      reason: err.reason || undefined,
      action: err.action || undefined,
      resource: err.resource || undefined,
      detail: err.message || "Unexpected error",
      instance: req.originalUrl,
      errors: details || undefined,
    },
  };

  if (status >= 500) {
    // Error server → log stack (jangan bocor ke client)
    console.error("Unhandled error:", {
      message: err.message,
      code: err.code,
      reason: err.reason,
      stack: err.stack,
    });
  } else {
    // Error 4xx → log ringkas
    console.warn("API error:", {
      status,
      code: err.code,
      reason: err.reason,
      message: err.message,
      path: req.originalUrl,
    });
  }

  res.status(status).json(body);
}
