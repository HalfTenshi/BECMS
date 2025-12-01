// src/utils/ApiError.js

/**
 * ApiError
 * Dipakai untuk melempar error terstruktur ke errorHandler.
 *
 * Properti yang didukung:
 * - status   : HTTP status code (number)
 * - code     : short code, mis. "VALIDATION_ERROR", "AUTH_REQUIRED"
 * - type     : URL type atau "about:blank"
 * - title    : judul singkat error (fallback kalau tidak di-set)
 * - details  : array/object detail (mis. errors dari express-validator)
 * - reason   : machine-friendly reason, mis. "RBAC_CHECK_FAILED"
 * - action   : aksi RBAC yang diminta, mis. "READ", "UPDATE"
 * - resource : resource RBAC yang diminta, mis. "CONTENT_ENTRIES"
 */

function defaultTitleFromStatus(status) {
  switch (status) {
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 409:
      return "Conflict";
    case 422:
      return "Unprocessable Entity";
    case 500:
      return "Internal Server Error";
    default:
      return "Error";
  }
}

export class ApiError extends Error {
  constructor(status, message, options = {}) {
    const finalStatus =
      typeof status === "number" && Number.isFinite(status) ? status : 500;
    const finalMessage =
      message || (finalStatus === 500 ? "Internal Server Error" : "Error");

    super(finalMessage);

    this.name = "ApiError";
    this.status = finalStatus; // HTTP status code

    // Standar RFC 7807-ish
    this.code = options.code; // short code, mis. "VALIDATION_ERROR"
    this.type = options.type || "about:blank";
    this.title = options.title || defaultTitleFromStatus(finalStatus);

    this.details = options.details; // array/object detail (mis. errors express-validator)

    // Field tambahan untuk kebutuhan observability / RBAC
    this.reason = options.reason; // machine-friendly reason, mis. "RBAC_CHECK_FAILED"
    this.action = options.action; // RBAC action, mis. "READ", "UPDATE"
    this.resource = options.resource; // RBAC resource/module, mis. "CONTENT_ENTRIES"

    // Simpan message asli juga (super sudah meng-set this.message)
    this.message = finalMessage;

    // Perbaikan stack trace (best practice)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Representasi plain object (mis. untuk logger atau errorHandler).
   */
  toJSON() {
    return {
      status: this.status,
      code: this.code,
      type: this.type,
      title: this.title,
      message: this.message,
      details: this.details,
      reason: this.reason,
      action: this.action,
      resource: this.resource,
    };
  }

  // ------- Static helpers (opsional, untuk dipakai di service) -------------

  /** 400 Bad Request */
  static badRequest(message, options = {}) {
    return new ApiError(400, message, options);
  }

  /** 401 Unauthorized */
  static unauthorized(message, options = {}) {
    return new ApiError(401, message, options);
  }

  /** 403 Forbidden */
  static forbidden(message, options = {}) {
    return new ApiError(403, message, options);
  }

  /** 404 Not Found */
  static notFound(message, options = {}) {
    return new ApiError(404, message, options);
  }

  /** 409 Conflict */
  static conflict(message, options = {}) {
    return new ApiError(409, message, options);
  }

  /** 422 Unprocessable Entity */
  static unprocessable(message, options = {}) {
    return new ApiError(422, message, options);
  }

  /** 500 Internal Server Error */
  static internal(message, options = {}) {
    return new ApiError(500, message, options);
  }
}
