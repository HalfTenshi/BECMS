// =========================================================
// src/constants/errorCodes.js
// =========================================================

/**
 * Global error code enum (SSOT)
 *
 * NOTE:
 * - Jangan hardcode string di service/controller, selalu pakai ERROR_CODES.
 * - Tambah kode baru di sini kalau ada behaviour baru.
 */
export const ERROR_CODES = {
  // ========================
  // SEO
  // ========================
  SEO_TITLE_TOO_LONG: "SEO_TITLE_TOO_LONG",
  SEO_DESCRIPTION_TOO_LONG: "SEO_DESCRIPTION_TOO_LONG",

  // ========================
  // General validation
  // ========================
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // ========================
  // Auth & Account
  // ========================
  AUTH_REQUIRED: "AUTH_REQUIRED",
  LOGIN_FAILED: "LOGIN_FAILED",
  REGISTER_FAILED: "REGISTER_FAILED",
  TOKEN_INVALID: "TOKEN_INVALID",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",

  // Password reset flow (opsional, anti user-enumeration)
  PASSWORD_RESET_INVALID: "PASSWORD_RESET_INVALID",
  PASSWORD_RESET_EXPIRED: "PASSWORD_RESET_EXPIRED",

  // Auth controller specific
  ME_FAILED: "ME_FAILED",
  REQUEST_RESET_FAILED: "REQUEST_RESET_FAILED",
  RESET_PASSWORD_FAILED: "RESET_PASSWORD_FAILED",
  GOOGLE_IDTOKEN_REQUIRED: "GOOGLE_IDTOKEN_REQUIRED",
  GOOGLE_LOGIN_FAILED: "GOOGLE_LOGIN_FAILED",

  // ========================
  // Workspace / Multi-tenant
  // ========================
  WORKSPACE_REQUIRED: "WORKSPACE_REQUIRED",
  WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
  MEMBER_NOT_FOUND: "MEMBER_NOT_FOUND",

  // ========================
  // RBAC / Permission
  // ========================
  FORBIDDEN_NO_ROLE: "FORBIDDEN_NO_ROLE",
  FORBIDDEN_NO_PERMISSION: "FORBIDDEN_NO_PERMISSION",
  ROLE_NOT_FOUND: "ROLE_NOT_FOUND",
  PERMISSION_NOT_FOUND: "PERMISSION_NOT_FOUND",
  PERMISSION_INVALID: "PERMISSION_INVALID",

  // ========================
  // Content & Content Model
  // ========================
  CONTENT_TYPE_NOT_FOUND: "CONTENT_TYPE_NOT_FOUND",
  CONTENT_ENTRY_NOT_FOUND: "CONTENT_ENTRY_NOT_FOUND",
  CONTENT_RELATION_NOT_FOUND: "CONTENT_RELATION_NOT_FOUND",
  CONTENT_FIELD_NOT_FOUND: "CONTENT_FIELD_NOT_FOUND",
  CONTENT_ENTRY_CREATE_VALIDATION_ERROR:
    "CONTENT_ENTRY_CREATE_VALIDATION_ERROR",
  SLUG_CONFLICT: "SLUG_CONFLICT",

  // ========================
  // Docs / OpenAPI
  // ========================
  DOCS_NOT_FOUND: "DOCS_NOT_FOUND",

  // ========================
  // Plan & Subscription
  // ========================
  PLAN_NOT_FOUND: "PLAN_NOT_FOUND",
  PLAN_LIMIT_EXCEEDED: "PLAN_LIMIT_EXCEEDED",
  PLAN_LIMIT_MEMBERS: "PLAN_LIMIT_MEMBERS",
  PLAN_LIMIT_CONTENT_TYPES: "PLAN_LIMIT_CONTENT_TYPES",
  PLAN_LIMIT_ENTRIES: "PLAN_LIMIT_ENTRIES",

  // ========================
  // Assets / Uploads
  // ========================
  ASSET_NOT_FOUND: "ASSET_NOT_FOUND",
  ASSET_VALIDATION_ERROR: "ASSET_VALIDATION_ERROR",

  // ========================
  // Brand & Product
  // ========================
  BRAND_NOT_FOUND: "BRAND_NOT_FOUND",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",

  // ========================
  // Billing / Xendit
  // ========================
  BILLING_CONFIG_ERROR: "BILLING_CONFIG_ERROR",
  BILLING_NETWORK_ERROR: "BILLING_NETWORK_ERROR",
  BILLING_GATEWAY_ERROR: "BILLING_GATEWAY_ERROR",
  BILLING_WEBHOOK_SIGNATURE_INVALID: "BILLING_WEBHOOK_SIGNATURE_INVALID",
  BILLING_WEBHOOK_PAYLOAD_INVALID: "BILLING_WEBHOOK_PAYLOAD_INVALID",
  BILLING_INVOICE_NOT_FOUND: "BILLING_INVOICE_NOT_FOUND",
};
