// src/middlewares/errorHandler.js

/**
 * Global error handler
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
 *     errors?: any           // detail tambahan (mis: dari express-validator)
 *   }
 * }
 *
 * Contoh untuk SEO:
 * 422 + new ApiError(422, "seoTitle must be at most 60 characters", {
 *   code: "SEO_TITLE_TOO_LONG",
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

  const status =
    typeof err.status === "number" && err.status >= 400 && err.status <= 599
      ? err.status
      : 500;

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

  const body = {
    success: false,
    error: {
      type: err.type || "about:blank",
      title: err.title || defaultTitle,
      status,
      code: err.code || undefined,
      // 🔥 field baru penting untuk RBAC & SEO
      reason: err.reason || undefined,
      action: err.action || undefined,
      resource: err.resource || undefined,
      detail: err.message || "Unexpected error",
      instance: req.originalUrl,
      errors: err.details || undefined,
    },
  };

  // (Opsional) log ke console untuk debugging dev
  if (status >= 500) {
    // Error server → log stack
    console.error("Unhandled error:", err);
  } else {
    // Error 4xx → cukup ringkas
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
