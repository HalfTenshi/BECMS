// src/constants/permissions.js

// ============================
// Single Source of Truth (SSOT)
// ============================
export const MODULE_KEYS = {
  AUTH: "AUTH",

  USERS: "USERS",
  WORKSPACES: "WORKSPACES",
  ROLES: "ROLES",
  PERMISSIONS: "PERMISSIONS",

  CONTENT_TYPES: "CONTENT_TYPES",
  CONTENT_FIELDS: "CONTENT_FIELDS",
  CONTENT_ENTRIES: "CONTENT_ENTRIES",
  CONTENT_RELATIONS: "CONTENT_RELATIONS",
  CONTENT_SEO: "CONTENT_SEO",

  PLANS: "PLANS",
  SUBSCRIPTIONS: "SUBSCRIPTIONS",
  BILLING: "BILLING",

  PRODUCTS: "PRODUCTS",
  BRANDS: "BRANDS",

  ASSETS: "ASSETS",
  UPLOADS: "UPLOADS",
};

// ============================
// ACTIONS (CRUD + PUBLISH + ALL)
// ============================
export const ACTIONS = {
  CREATE: "CREATE",
  READ: "READ",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  PUBLISH: "PUBLISH",
  ALL: "ALL",
};

// ============================
// RESOURCES (alias ke MODULE_KEYS)
// ============================
// → router & authorize() memakai ini
// → module=RESOURCES.X akan selalu sama dengan enum di Prisma
export const RESOURCES = {
  ...MODULE_KEYS,
  ALL: "ALL",
};
