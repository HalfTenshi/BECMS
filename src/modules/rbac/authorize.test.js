// src/modules/rbac/authorize.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "../../utils/ApiError.js";

// 🔧 Mock prismaClient yang dipakai di authorize.js
vi.mock("../../config/prismaClient.js", () => {
  const workspace = {
    findUnique: vi.fn(),
  };
  const workspaceMember = {
    findUnique: vi.fn(),
  };
  const rolePermission = {
    findFirst: vi.fn(),
  };

  return {
    default: {
      workspace,
      workspaceMember,
      rolePermission,
    },
  };
});

// Ambil prisma mock untuk dikonfigurasi per test
import prisma from "../../config/prismaClient.js";

// Setelah mock siap, baru import authorize (supaya pakai prisma yang sudah di-mock)
import { authorize } from "../../middlewares/authorize.js";

function createReq({
  user,
  workspace,
  headers,
  ctx,
  body,
  query,
  params,
} = {}) {
  return {
    user: user || null,
    workspace: workspace || null,
    headers: headers || {},
    ctx: ctx || {},
    body: body || {},
    query: query || {},
    params: params || {},
    _permCache: undefined,
  };
}

function createRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function createNext() {
  return vi.fn();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authorize middleware (RBAC)", () => {
  it("should fail with AUTH_REQUIRED when user is missing", async () => {
    const mw = authorize("READ", "CONTENT_ENTRIES");
    const req = createReq(); // tanpa user
    const res = createRes();
    const next = createNext();

    await mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe("AUTH_REQUIRED");
    expect(err.reason).toBe("AUTH_REQUIRED");
  });

  it("should fail with ACCOUNT_INACTIVE when user status is SUSPENDED", async () => {
    const mw = authorize("READ", "CONTENT_ENTRIES");
    const req = createReq({
      user: { id: "u1", status: "SUSPENDED" },
    });
    const res = createRes();
    const next = createNext();

    await mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe("ACCOUNT_INACTIVE");
    expect(err.reason).toBe("ACCOUNT_INACTIVE");
  });

  it("should fail with WORKSPACE_REQUIRED when no workspaceId is provided", async () => {
    const mw = authorize("READ", "CONTENT_ENTRIES");
    const req = createReq({
      user: { id: "u1", status: "ACTIVE" },
      // tidak ada workspace, ctx, ataupun header x-workspace-id
    });
    const res = createRes();
    const next = createNext();

    await mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe("WORKSPACE_REQUIRED");
    expect(err.reason).toBe("WORKSPACE_REQUIRED");
  });

  it("should bypass permission check when user is workspace owner", async () => {
    const mw = authorize("READ", "CONTENT_ENTRIES");

    prisma.workspace.findUnique.mockResolvedValue({
      id: "w1",
      ownerId: "u1",
    });

    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    const req = createReq({
      user: { id: "u1", status: "ACTIVE" },
      headers: { "x-workspace-id": "w1" },
    });
    const res = createRes();
    const next = createNext();

    await mw(req, res, next);

    expect(prisma.workspace.findUnique).toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined(); // sukses → next tanpa error
  });

  it("should fail with FORBIDDEN_NO_ROLE when membership is missing", async () => {
    const mw = authorize("READ", "CONTENT_ENTRIES");

    prisma.workspace.findUnique.mockResolvedValue({
      id: "w1",
      ownerId: "owner-other",
    });

    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    const req = createReq({
      user: { id: "u2", status: "ACTIVE" },
      headers: { "x-workspace-id": "w1" },
    });
    const res = createRes();
    const next = createNext();

    await mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN_NO_ROLE");
    expect(err.reason).toBe("RBAC_NO_ROLE_IN_WORKSPACE");
  });

  it("should fail with FORBIDDEN_NO_PERMISSION when no matching permission", async () => {
    const mw = authorize("READ", "CONTENT_ENTRIES");

    prisma.workspace.findUnique.mockResolvedValue({
      id: "w1",
      ownerId: "owner-other",
    });

    prisma.workspaceMember.findUnique.mockResolvedValue({
      roleId: "role-123",
    });

    prisma.rolePermission.findFirst.mockResolvedValue(null);

    const req = createReq({
      user: { id: "u2", status: "ACTIVE" },
      headers: { "x-workspace-id": "w1" },
    });
    const res = createRes();
    const next = createNext();

    await mw(req, res, next);

    expect(prisma.rolePermission.findFirst).toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN_NO_PERMISSION");
    expect(err.reason).toBe("RBAC_CHECK_FAILED");
    expect(err.action).toBe("READ");
    expect(err.resource).toBe("CONTENT_ENTRIES");
  });

  it("should pass when permission exists", async () => {
    const mw = authorize("READ", "CONTENT_ENTRIES");

    prisma.workspace.findUnique.mockResolvedValue({
      id: "w1",
      ownerId: "owner-other",
    });

    prisma.workspaceMember.findUnique.mockResolvedValue({
      roleId: "role-123",
    });

    prisma.rolePermission.findFirst.mockResolvedValue({
      id: "rp-1",
    });

    const req = createReq({
      user: { id: "u2", status: "ACTIVE" },
      headers: { "x-workspace-id": "w1" },
    });
    const res = createRes();
    const next = createNext();

    await mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined(); // sukses → next tanpa error
  });
});
