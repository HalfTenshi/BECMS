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
export class ApiError extends Error {
  constructor(status, message, options = {}) {
    super(message);

    this.status = status; // HTTP status code
    this.code = options.code; // short code, mis. "VALIDATION_ERROR"
    this.type = options.type; // URL type or "about:blank"
    this.title = options.title; // fallback title
    this.details = options.details; // array/object detail (mis. errors express-validator)

    // Field tambahan untuk kebutuhan observability / RBAC
    this.reason = options.reason; // machine-friendly reason, mis. "RBAC_CHECK_FAILED"
    this.action = options.action; // RBAC action, mis. "READ", "UPDATE"
    this.resource = options.resource; // RBAC resource/module, mis. "CONTENT_ENTRIES"

    // Perbaikan stack trace (best practice)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}
