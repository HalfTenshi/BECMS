// src/middlewares/errorHandler.js

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || 500;

  const body = {
    success: false,
    error: {
      type: err.type || "about:blank",
      title:
        err.title ||
        (status === 400
          ? "Bad Request"
          : status === 401
          ? "Unauthorized"
          : status === 403
          ? "Forbidden"
          : status === 404
          ? "Not Found"
          : status >= 500
          ? "Internal Server Error"
          : "Error"),
      status,
      code: err.code || undefined,
      detail: err.message || "Unexpected error",
      instance: req.originalUrl,
      errors: err.details || undefined,

      // Tambahan field untuk debugging / observability / RBAC
      reason: err.reason || undefined,
      action: err.action || undefined,
      resource: err.resource || undefined,
    },
  };

  res.status(status).json(body);
}
