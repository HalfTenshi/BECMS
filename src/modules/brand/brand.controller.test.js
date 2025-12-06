// =========================================================
// src/modules/brand/brand.controller.test.js
// =========================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks harus pakai path yang SAMA persis dengan di brand.controller.js
vi.mock("./brand.service.js", () => {
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

import brandService from "./brand.service.js";
import { ok, created, noContent } from "../../utils/response.js";
import brandController from "./brand.controller.js";

describe("BrandController", () => {
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

    res = {}; // res di-wrap di helper ok/created/noContent, jadi cukup objek kosong

    next = vi.fn();

    vi.clearAllMocks();
  });

  // ---------- getAll ---------------------------------------------------------
  it("getAll → memanggil brandService.list dengan workspaceId & mengembalikan ok()", async () => {
    const fakeResult = [{ id: "brand_1" }];
    brandService.list.mockResolvedValue(fakeResult);

    await brandController.getAll(req, res, next);

    expect(brandService.list).toHaveBeenCalledTimes(1);
    expect(brandService.list).toHaveBeenCalledWith(
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
    brandService.list.mockRejectedValue(err);

    await brandController.getAll(req, res, next);

    expect(ok).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(err);
  });

  // ---------- getById --------------------------------------------------------
  it("getById → memanggil brandService.get dengan id & workspaceId, lalu ok()", async () => {
    const fakeBrand = { id: "b1", name: "Brand A" };
    brandService.get.mockResolvedValue(fakeBrand);
    req.params.id = "b1";

    await brandController.getById(req, res, next);

    expect(brandService.get).toHaveBeenCalledTimes(1);
    expect(brandService.get).toHaveBeenCalledWith({
      workspaceId: "ws_123",
      id: "b1",
    });

    expect(ok).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledWith(res, fakeBrand);
    expect(next).not.toHaveBeenCalled();
  });

  it("getById → error dari service diteruskan ke next()", async () => {
    const err = new Error("not found");
    brandService.get.mockRejectedValue(err);
    req.params.id = "b1";

    await brandController.getById(req, res, next);

    expect(ok).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  // ---------- create ---------------------------------------------------------
  it("create → memanggil brandService.create dengan workspaceId & payload, lalu created()", async () => {
    const payload = { name: "New Brand" };
    const fakeBrand = { id: "b2", ...payload };

    req.body = payload;
    brandService.create.mockResolvedValue(fakeBrand);

    await brandController.create(req, res, next);

    expect(brandService.create).toHaveBeenCalledTimes(1);
    expect(brandService.create).toHaveBeenCalledWith({
      workspaceId: "ws_123",
      payload,
    });

    expect(created).toHaveBeenCalledTimes(1);
    expect(created).toHaveBeenCalledWith(res, fakeBrand);
    expect(next).not.toHaveBeenCalled();
  });

  it("create → error dari service diteruskan ke next()", async () => {
    const err = new Error("validation");
    brandService.create.mockRejectedValue(err);

    await brandController.create(req, res, next);

    expect(created).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  // ---------- update ---------------------------------------------------------
  it("update → memanggil brandService.update dengan id, workspaceId & payload, lalu ok()", async () => {
    const payload = { name: "Updated Brand" };
    const fakeBrand = { id: "b3", ...payload };

    req.params.id = "b3";
    req.body = payload;
    brandService.update.mockResolvedValue(fakeBrand);

    await brandController.update(req, res, next);

    expect(brandService.update).toHaveBeenCalledTimes(1);
    expect(brandService.update).toHaveBeenCalledWith({
      workspaceId: "ws_123",
      id: "b3",
      payload,
    });

    expect(ok).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledWith(res, fakeBrand);
    expect(next).not.toHaveBeenCalled();
  });

  it("update → error dari service diteruskan ke next()", async () => {
    const err = new Error("boom");
    brandService.update.mockRejectedValue(err);

    await brandController.update(req, res, next);

    expect(ok).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  // ---------- delete / remove ------------------------------------------------
  it("delete → memanggil brandService.remove dan merespon noContent()", async () => {
    req.params.id = "b4";
    brandService.remove.mockResolvedValue(undefined);

    await brandController.delete(req, res, next);

    expect(brandService.remove).toHaveBeenCalledTimes(1);
    expect(brandService.remove).toHaveBeenCalledWith({
      workspaceId: "ws_123",
      id: "b4",
    });

    expect(noContent).toHaveBeenCalledTimes(1);
    expect(noContent).toHaveBeenCalledWith(res);
    expect(next).not.toHaveBeenCalled();
  });

  it("delete → error dari service diteruskan ke next()", async () => {
    const err = new Error("cannot delete");
    brandService.remove.mockRejectedValue(err);

    await brandController.delete(req, res, next);

    expect(noContent).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  // ---------- workspaceId fallback behaviour ---------------------------------
  it("menggunakan req.workspace.id ketika req.workspaceId tidak ada", async () => {
    // simulate middleware hanya mengisi req.workspace
    req.workspaceId = undefined;
    req.workspace = { id: "ws_fallback" };

    const fakeResult = [{ id: "brand_1" }];
    brandService.list.mockResolvedValue(fakeResult);

    await brandController.getAll(req, res, next);

    expect(brandService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws_fallback",
      }),
    );
  });
});
