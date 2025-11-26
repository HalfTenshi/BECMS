// src/utils/ApiError.js

/**
 * ApiError
 * Dipakai untuk melempar error terstruktur ke errorHandler.
 */
export class ApiError extends Error {
  constructor(status, message, options = {}) {
    super(message);

    this.status = status; // HTTP status code
    this.code = options.code; // short code, mis. "VALIDATION_ERROR"
    this.type = options.type; // URL type or "about:blank"
    this.title = options.title; // fallback title
    this.details = options.details; // array/object detail (mis. errors express-validator)
  }
}
