// =========================================================
// src/modules/rbac/routeProtection.test.js
// =========================================================

// @ts-nocheck

import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { ERROR_CODES } from "../../constants/errorCodes.js";
import { ApiError } from "../../utils/ApiError.js";

// ---------------------------------------------------------------------
// MOCK MIDDLEWARE: auth, workspaceContext, authorize
// ---------------------------------------------------------------------

/**
 * auth mock:
 * - Baca header x-test-perms → "READ:BRANDS,CREATE:PRODUCTS"
 * - Pasang req.user.permissions = [ "READ:BRANDS", ... ]
 */
vi.mock("../../middlewares/auth.js", () => {
  return {
    auth: (req, _res, next) => {
      const header = req.headers["x-test-perms"];
      const perms = header
        ? String(header)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      req.user = {
        id: "test-user",
        permissions: perms,
      };
      next();
    },
  };
});

/**
 * workspaceContext (versi dari middlewares/workspace.js)
 * - Pastikan req.workspace.id selalu ada (ambil dari x-workspace-id kalau ada)
 */
vi.mock("../../middlewares/workspace.js", () => {
  return {
    workspaceContext: (req, _res, next) => {
      const wsId = req.headers["x-workspace-id"] || "ws-test";
      req.workspace = { id: String(wsId) };
      next();
    },
  };
});

/**
 * workspaceContext / workspaceGuard (versi dari middlewares/workspaceContext.js)
 * - Beberapa route admin pakai default export / workspaceGuard dari file ini
 */
vi.mock("../../middlewares/workspaceContext.js", () => {
  const attachWs = (req, _res, next) => {
    const wsId = req.headers["x-workspace-id"] || "ws-test";
    req.workspace = { id: String(wsId) };
    next();
  };
  return {
    default: attachWs,
    workspaceGuard: attachWs,
  };
});

/**
 * authorize mock:
 * - Gunakan ACTION & RESOURCE dari route (bukan string literal).
 * - Cek apakah kombinasi `${action}:${resource}` ada di req.user.permissions.
 * - Kalau tidak ada → lempar ApiError.forbidden dengan code FORBIDDEN_NO_PERMISSION.
 *
 * Ini memastikan:
 *  - Route memang pakai ACTIONS/RESOURCES yang benar.
 *  - Error 403 ter-mapping jadi body error dengan code yang konsisten.
 */
vi.mock("../../middlewares/authorize.js", async () => {
  const { ERROR_CODES } = await import("../../constants/errorCodes.js");

  return {
    authorize:
      (action, resource) =>
      (req, _res, next) => {
        const perms = req.user?.permissions || [];
        const key = `${action}:${resource}`;
        if (perms.includes(key)) {
          return next();
        }

        return next(
          ApiError.forbidden("Forbidden", {
            code: ERROR_CODES.FORBIDDEN_NO_PERMISSION,
            action,
            resource,
          })
        );
      },
  };
});

// ---------------------------------------------------------------------
// MOCK CONTROLLERS: brand / product / content
// Supaya test tidak menyentuh DB, hanya verifikasi proteksi route.
// ---------------------------------------------------------------------

vi.mock("../../modules/brand/brand.controller.js", () => {
  return {
    default: {
      getAll: (_req, res) => res.json({ ok: true, route: "brand.getAll" }),
      getById: (_req, res) => res.json({ ok: true, route: "brand.getById" }),
      create: (_req, res) => res.status(201).json({ ok: true, route: "brand.create" }),
      update: (_req, res) => res.json({ ok: true, route: "brand.update" }),
      delete: (_req, res) => res.json({ ok: true, route: "brand.delete" }),
    },
  };
});

vi.mock("../../modules/product/product.controller.js", () => {
  return {
    default: {
      getAll: (_req, res) => res.json({ ok: true, route: "product.getAll" }),
      getById: (_req, res) => res.json({ ok: true, route: "product.getById" }),
      create: (_req, res) => res.status(201).json({ ok: true, route: "product.create" }),
      update: (_req, res) => res.json({ ok: true, route: "product.update" }),
      delete: (_req, res) => res.json({ ok: true, route: "product.delete" }),
    },
  };
});

vi.mock("../../modules/content/contentType.controller.js", () => {
  return {
    default: {
      getAll: (_req, res) => res.json({ ok: true, route: "contentType.getAll" }),
      getById: (_req, res) => res.json({ ok: true, route: "contentType.getById" }),
      create: (_req, res) => res.status(201).json({ ok: true, route: "contentType.create" }),
      update: (_req, res) => res.json({ ok: true, route: "contentType.update" }),
      delete: (_req, res) => res.json({ ok: true, route: "contentType.delete" }),
    },
  };
});

vi.mock("../../modules/content/contentEntry.controller.js", () => {
  return {
    default: {
      getAll: (_req, res) => res.json({ ok: true, route: "contentEntry.getAll" }),
      getById: (_req, res) => res.json({ ok: true, route: "contentEntry.getById" }),
      create: (_req, res) => res.status(201).json({ ok: true, route: "contentEntry.create" }),
      update: (_req, res) => res.json({ ok: true, route: "contentEntry.update" }),
      publish: (_req, res) => res.json({ ok: true, route: "contentEntry.publish" }),
      delete: (_req, res) => res.json({ ok: true, route: "contentEntry.delete" }),
      listByContentType: (_req, res) =>
        res.json({ ok: true, route: "contentEntry.listByContentType" }),
      searchForRelation: (_req, res) =>
        res.json({ ok: true, route: "contentEntry.searchForRelation" }),
    },
  };
});

// ---------------------------------------------------------------------
// APP SETUP UNTUK TEST
// ---------------------------------------------------------------------

let app;

beforeAll(async () => {
  const express = (await import("express")).default;
  const { errorHandler } = await import("../../middlewares/errorHandler.js");

  const brandAdminRoutes = (await import("../../routes/admin/brand.admin.routes.js")).default;
  const productAdminRoutes = (await import("../../routes/admin/product.admin.routes.js")).default;
  const contentAdminRoutes = (await import("../../routes/admin/content.admin.routes.js")).default;

  app = express();
  app.use(express.json());

  app.use("/api/admin/brands", brandAdminRoutes);
  app.use("/api/admin/products", productAdminRoutes);
  app.use("/api/admin/content", contentAdminRoutes);

  // Global error handler agar ApiError → JSON rapi
  app.use(errorHandler);
});

// ---------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------

describe("RBAC route protection (admin routes)", () => {
  // ---------------------------
  // BRAND ADMIN
  // ---------------------------
  it("allows access to brand admin list when permission present", async () => {
    const res = await request(app)
      .get("/api/admin/brands")
      .set("x-workspace-id", "ws-1")
      .set("x-test-perms", "READ:BRANDS");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        route: "brand.getAll",
      })
    );
  });

  it("returns 403 FORBIDDEN_NO_PERMISSION for brand admin list without permission", async () => {
    const res = await request(app)
      .get("/api/admin/brands")
      .set("x-workspace-id", "ws-1"); // tanpa x-test-perms

    expect(res.status).toBe(403);
    expect(res.body?.success).toBe(false);
    expect(res.body?.error?.code).toBe(ERROR_CODES.FORBIDDEN_NO_PERMISSION);
    expect(res.body?.error?.status).toBe(403);
  });

  // ---------------------------
  // PRODUCT ADMIN
  // ---------------------------
  it("allows access to product admin create when permission present", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("x-workspace-id", "ws-1")
      .set("x-test-perms", "CREATE:PRODUCTS")
      .send({ name: "Test Product" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        route: "product.create",
      })
    );
  });

  it("returns 403 FORBIDDEN_NO_PERMISSION for product admin create without permission", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("x-workspace-id", "ws-1")
      .send({ name: "Test Product" });

    expect(res.status).toBe(403);
    expect(res.body?.success).toBe(false);
    expect(res.body?.error?.code).toBe(ERROR_CODES.FORBIDDEN_NO_PERMISSION);
  });

  // ---------------------------
  // CONTENT ADMIN - TYPES
  // ---------------------------
  it("allows access to content admin types list when READ:CONTENT_TYPES permission present", async () => {
    const res = await request(app)
      .get("/api/admin/content/types")
      .set("x-workspace-id", "ws-1")
      .set("x-test-perms", "READ:CONTENT_TYPES");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        route: "contentType.getAll",
      })
    );
  });

  it("returns 403 FORBIDDEN_NO_PERMISSION for content admin types list without permission", async () => {
    const res = await request(app)
      .get("/api/admin/content/types")
      .set("x-workspace-id", "ws-1");

    expect(res.status).toBe(403);
    expect(res.body?.error?.code).toBe(ERROR_CODES.FORBIDDEN_NO_PERMISSION);
  });

  // ---------------------------
  // CONTENT ADMIN - ENTRIES
  // ---------------------------
  it("allows access to content admin entries list when READ:CONTENT_ENTRIES permission present", async () => {
    const res = await request(app)
      .get("/api/admin/content/entries")
      .set("x-workspace-id", "ws-1")
      .set("x-test-perms", "READ:CONTENT_ENTRIES");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        route: "contentEntry.getAll",
      })
    );
  });

  it("returns 403 FORBIDDEN_NO_PERMISSION for content admin entries list without permission", async () => {
    const res = await request(app)
      .get("/api/admin/content/entries")
      .set("x-workspace-id", "ws-1");

    expect(res.status).toBe(403);
    expect(res.body?.error?.code).toBe(ERROR_CODES.FORBIDDEN_NO_PERMISSION);
  });
});
