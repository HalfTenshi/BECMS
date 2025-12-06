// =========================================================
// src/services/planLimit.service.test.js
// =========================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

import { enforcePlanLimit, PLAN_LIMIT_ACTIONS } from "./planLimit.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ERROR_CODES } from "../constants/errorCodes.js";

// --------- Mock prisma -----------------------------------
vi.mock("../config/prismaClient.js", () => {
  const workspace = {
    findUnique: vi.fn(),
  };

  const workspaceMember = {
    count: vi.fn(),
  };

  const contentType = {
    count: vi.fn(),
  };

  const contentEntry = {
    count: vi.fn(),
  };

  const prisma = {
    workspace,
    workspaceMember,
    contentType,
    contentEntry,
  };

  return {
    default: prisma,
  };
});

// --------- Import mock instance untuk inspeksi -----------
import prisma from "../config/prismaClient.js";

// =========================================================
// TESTS
// =========================================================

describe("planLimit.service - enforcePlanLimit()", () => {
  const workspaceId = "ws_test";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper: set workspace + plan limit
  function mockWorkspacePlan({
    maxMembers = null,
    maxContentTypes = null,
    maxEntries = null,
  } = {}) {
    prisma.workspace.findUnique.mockResolvedValue({
      id: workspaceId,
      plan: {
        id: "plan_basic",
        name: "Basic",
        maxMembers,
        maxContentTypes,
        maxEntries,
      },
    });
  }

  // -------------------------------------------------------
  // MEMBER LIMIT
  // -------------------------------------------------------
  it("should throw ApiError PLAN_LIMIT_MEMBERS when member usage reaches limit", async () => {
    mockWorkspacePlan({ maxMembers: 3, maxContentTypes: 10, maxEntries: 100 });

    prisma.workspaceMember.count.mockResolvedValue(3);

    await expect(
      enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_MEMBER)
    ).rejects.toBeInstanceOf(ApiError);

    await expect(
      enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_MEMBER)
    ).rejects.toMatchObject({
      status: 403,
      code: ERROR_CODES.PLAN_LIMIT_MEMBERS,
      reason: ERROR_CODES.PLAN_LIMIT_EXCEEDED,
      resource: "MEMBERS",
      action: PLAN_LIMIT_ACTIONS.ADD_MEMBER,
    });
  });

  // -------------------------------------------------------
  // CONTENT TYPE LIMIT
  // -------------------------------------------------------
  it("should throw ApiError PLAN_LIMIT_CONTENT_TYPES when content type usage reaches limit", async () => {
    mockWorkspacePlan({ maxMembers: 10, maxContentTypes: 2, maxEntries: 100 });

    prisma.contentType.count.mockResolvedValue(2);

    await expect(
      enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_CONTENT_TYPE)
    ).rejects.toBeInstanceOf(ApiError);

    await expect(
      enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_CONTENT_TYPE)
    ).rejects.toMatchObject({
      status: 403,
      code: ERROR_CODES.PLAN_LIMIT_CONTENT_TYPES,
      reason: ERROR_CODES.PLAN_LIMIT_EXCEEDED,
      resource: "CONTENT_TYPES",
      action: PLAN_LIMIT_ACTIONS.ADD_CONTENT_TYPE,
    });
  });

  // -------------------------------------------------------
  // ENTRY LIMIT
  // -------------------------------------------------------
  it("should throw ApiError PLAN_LIMIT_ENTRIES when entry usage reaches limit", async () => {
    mockWorkspacePlan({ maxMembers: 10, maxContentTypes: 10, maxEntries: 5 });

    prisma.contentEntry.count.mockResolvedValue(5);

    await expect(
      enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_ENTRY)
    ).rejects.toBeInstanceOf(ApiError);

    await expect(
      enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_ENTRY)
    ).rejects.toMatchObject({
      status: 403,
      code: ERROR_CODES.PLAN_LIMIT_ENTRIES,
      reason: ERROR_CODES.PLAN_LIMIT_EXCEEDED,
      resource: "CONTENT_ENTRIES",
      action: PLAN_LIMIT_ACTIONS.ADD_ENTRY,
    });
  });

  // -------------------------------------------------------
  // POSITIVE CASE: tidak kena limit → tidak throw
  // -------------------------------------------------------
  it("should NOT throw when current usage is below limit", async () => {
    mockWorkspacePlan({ maxMembers: 10, maxContentTypes: 10, maxEntries: 10 });

    prisma.workspaceMember.count.mockResolvedValue(3);
    prisma.contentType.count.mockResolvedValue(1);
    prisma.contentEntry.count.mockResolvedValue(4);

    // Semua action di bawah limit → tidak error
    await expect(
      enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_MEMBER)
    ).resolves.toBeUndefined();

    await expect(
      enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_CONTENT_TYPE)
    ).resolves.toBeUndefined();

    await expect(
      enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_ENTRY)
    ).resolves.toBeUndefined();
  });

  // -------------------------------------------------------
  // POSITIVE CASE: workspace tanpa plan → unlimited
  // -------------------------------------------------------
  it("should NOT throw when workspace has no plan (treated as unlimited)", async () => {
    prisma.workspace.findUnique.mockResolvedValue({
      id: workspaceId,
      plan: null,
    });

    prisma.workspaceMember.count.mockResolvedValue(999);
    prisma.contentType.count.mockResolvedValue(999);
    prisma.contentEntry.count.mockResolvedValue(999);

    await expect(
      enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_MEMBER)
    ).resolves.toBeUndefined();

    await expect(
      enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_CONTENT_TYPE)
    ).resolves.toBeUndefined();

    await expect(
      enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_ENTRY)
    ).resolves.toBeUndefined();
  });
});
