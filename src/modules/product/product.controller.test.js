// =========================================================
// src/modules/product/product.controller.test.js
// =========================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks harus pakai path yang SAMA persis dengan di product.controller.js
vi.mock("./product.service.js", () => {
  return {
    default: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
  };
});

vi.mock("../../utils/response.js", () => {
  return {
    ok: vi.fn(),
    created: vi.fn(),
    noContent: vi.fn(),
  };
});

import productService from "./product.service.js";
import { ok, created, noContent } from "../../utils/response.js";
import productController from "./product.controller.js";

describe("ProductController", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      workspaceId: "ws_123",
      workspace: { id: "ws_123" },
    };

    res = {};
    next = vi.fn();

    vi.clearAllMocks();
  });

  // ---------- getAll ---------------------------------------------------------
  it("getAll → memanggil productService.list dengan workspaceId & mengembalikan ok()", async () => {
    const fakeResult = [{ id: "p1" }];
    productService.list.mockResolvedValue(fakeResult);

    await productController.getAll(req, res, next);

    expect(productService.list).toHaveBeenCalledTimes(1);
    expect(productService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws_123",
      }),
    );

    expect(ok).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledWith(res, fakeResult);
    expect(next).not.toHaveBeenCalled();
  });

  it("getAll → jika service throw, meneruskan error ke next()", async () => {
    const err = new Error("boom");
    productService.list.mockRejectedValue(err);

    await productController.getAll(req, res, next);

    expect(ok).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  // ---------- getById --------------------------------------------------------
  it("getById → memanggil productService.get dengan id & workspaceId, lalu ok()", async () => {
    const fakeProduct = { id: "p1", name: "Product A" };
    productService.get.mockResolvedValue(fakeProduct);
    req.params.id = "p1";

    await productController.getById(req, res, next);

    expect(productService.get).toHaveBeenCalledTimes(1);
    expect(productService.get).toHaveBeenCalledWith({
      workspaceId: "ws_123",
      id: "p1",
    });

    expect(ok).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledWith(res, fakeProduct);
    expect(next).not.toHaveBeenCalled();
  });

  it("getById → error dari service diteruskan ke next()", async () => {
    const err = new Error("not found");
    productService.get.mockRejectedValue(err);
    req.params.id = "p1";

    await productController.getById(req, res, next);

    expect(ok).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  // ---------- create ---------------------------------------------------------
  it("create → memanggil productService.create dengan workspaceId & payload, lalu created()", async () => {
    const payload = { name: "New Product" };
    const fakeProduct = { id: "p2", ...payload };

    req.body = payload;
    productService.create.mockResolvedValue(fakeProduct);

    await productController.create(req, res, next);

    expect(productService.create).toHaveBeenCalledTimes(1);
    expect(productService.create).toHaveBeenCalledWith({
      workspaceId: "ws_123",
      payload,
    });

    expect(created).toHaveBeenCalledTimes(1);
    expect(created).toHaveBeenCalledWith(res, fakeProduct);
    expect(next).not.toHaveBeenCalled();
  });

  it("create → error dari service diteruskan ke next()", async () => {
    const err = new Error("validation");
    productService.create.mockRejectedValue(err);

    await productController.create(req, res, next);

    expect(created).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  // ---------- update ---------------------------------------------------------
  it("update → memanggil productService.update dengan id, workspaceId & payload, lalu ok()", async () => {
    const payload = { name: "Updated Product" };
    const fakeProduct = { id: "p3", ...payload };

    req.params.id = "p3";
    req.body = payload;
    productService.update.mockResolvedValue(fakeProduct);

    await productController.update(req, res, next);

    expect(productService.update).toHaveBeenCalledTimes(1);
    expect(productService.update).toHaveBeenCalledWith({
      workspaceId: "ws_123",
      id: "p3",
      payload,
    });

    expect(ok).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledWith(res, fakeProduct);
    expect(next).not.toHaveBeenCalled();
  });

  it("update → error dari service diteruskan ke next()", async () => {
    const err = new Error("boom");
    productService.update.mockRejectedValue(err);

    await productController.update(req, res, next);

    expect(ok).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  // ---------- delete / remove ------------------------------------------------
  it("delete → memanggil productService.remove dan merespon noContent()", async () => {
    req.params.id = "p4";
    productService.remove.mockResolvedValue(undefined);

    await productController.delete(req, res, next);

    expect(productService.remove).toHaveBeenCalledTimes(1);
    expect(productService.remove).toHaveBeenCalledWith({
      workspaceId: "ws_123",
      id: "p4",
    });

    expect(noContent).toHaveBeenCalledTimes(1);
    expect(noContent).toHaveBeenCalledWith(res);
    expect(next).not.toHaveBeenCalled();
  });

  it("delete → error dari service diteruskan ke next()", async () => {
    const err = new Error("cannot delete");
    productService.remove.mockRejectedValue(err);

    await productController.delete(req, res, next);

    expect(noContent).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  // ---------- workspaceId fallback behaviour ---------------------------------
  it("menggunakan req.workspace.id ketika req.workspaceId tidak ada", async () => {
    req.workspaceId = undefined;
    req.workspace = { id: "ws_fallback" };

    const fakeResult = [{ id: "p1" }];
    productService.list.mockResolvedValue(fakeResult);

    await productController.getAll(req, res, next);

    expect(productService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws_fallback",
      }),
    );
  });
});
