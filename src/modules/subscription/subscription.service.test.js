// =========================================================
// src/modules/subscription/subscription.service.test.js
// =========================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

import subscriptionService from "./subscription.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

// --------- Mock prisma -----------------------------------
vi.mock("../../config/prismaClient.js", () => {
  const workspace = { findUnique: vi.fn() };
  const workspaceMember = { count: vi.fn() };
  const contentType = { count: vi.fn() };
  const contentEntry = { count: vi.fn() };

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

// --------- Mock subscription.repository ------------------
vi.mock("./subscription.repository.js", () => {
  const repo = {
    getActiveByWorkspace: vi.fn(),
    listByWorkspace: vi.fn(),
    expireAllActive: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
  };

  return {
    default: repo,
  };
});

// --------- Import mock instance untuk inspeksi -----------
import prisma from "../../config/prismaClient.js";
import subscriptionRepository from "./subscription.repository.js";

// =========================================================
// TESTS
// =========================================================

describe("SubscriptionService", () => {
  const workspaceId = "ws_test";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------
  // getWorkspacePlanStatus
  // -------------------------------------------------------
  describe("getWorkspacePlanStatus()", () => {
    it("should throw 400 WORKSPACE_REQUIRED when workspaceId is missing", async () => {
      await expect(
        subscriptionService.getWorkspacePlanStatus(undefined)
      ).rejects.toBeInstanceOf(ApiError);

      await expect(
        subscriptionService.getWorkspacePlanStatus(undefined)
      ).rejects.toMatchObject({
        status: 400,
        code: ERROR_CODES.WORKSPACE_REQUIRED,
        reason: "SUBSCRIPTION_WORKSPACE_ID_REQUIRED",
      });
    });

    it("should throw 404 WORKSPACE_NOT_FOUND when workspace does not exist", async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(
        subscriptionService.getWorkspacePlanStatus(workspaceId)
      ).rejects.toBeInstanceOf(ApiError);

      await expect(
        subscriptionService.getWorkspacePlanStatus(workspaceId)
      ).rejects.toMatchObject({
        status: 404,
        code: ERROR_CODES.WORKSPACE_NOT_FOUND,
        resource: "WORKSPACES",
      });
    });

    it("should resolve with plan + usage when workspace exists", async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        plan: {
          id: "plan_basic",
          name: "Basic",
          maxMembers: 5,
          maxContentTypes: 10,
          maxEntries: 100,
        },
      });

      prisma.workspaceMember.count.mockResolvedValue(2);
      prisma.contentType.count.mockResolvedValue(3);
      prisma.contentEntry.count.mockResolvedValue(4);

      const result = await subscriptionService.getWorkspacePlanStatus(
        workspaceId
      );

      expect(result.workspace.id).toBe(workspaceId);
      expect(result.plan).toMatchObject({
        id: "plan_basic",
        name: "Basic",
        maxMembers: 5,
      });
      expect(result.usage.members.current).toBe(2);
      expect(result.usage.entries.current).toBe(4);
    });
  });

  // -------------------------------------------------------
  // cancelActiveSubscription
  // -------------------------------------------------------
  describe("cancelActiveSubscription()", () => {
    it("should throw 400 WORKSPACE_REQUIRED when workspaceId is missing", async () => {
      await expect(
        subscriptionService.cancelActiveSubscription(undefined)
      ).rejects.toBeInstanceOf(ApiError);

      await expect(
        subscriptionService.cancelActiveSubscription(undefined)
      ).rejects.toMatchObject({
        status: 400,
        code: ERROR_CODES.WORKSPACE_REQUIRED,
        reason: "SUBSCRIPTION_WORKSPACE_ID_REQUIRED",
      });
    });

    it("should throw 404 SUBSCRIPTION_NOT_FOUND when no active subscription", async () => {
      subscriptionRepository.getActiveByWorkspace.mockResolvedValue(null);

      await expect(
        subscriptionService.cancelActiveSubscription(workspaceId)
      ).rejects.toBeInstanceOf(ApiError);

      await expect(
        subscriptionService.cancelActiveSubscription(workspaceId)
      ).rejects.toMatchObject({
        status: 404,
        code: ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
        resource: "SUBSCRIPTIONS",
      });
    });
  });

  // -------------------------------------------------------
  // handleBillingWebhookEvent
  // -------------------------------------------------------
  describe("handleBillingWebhookEvent()", () => {
    it("should throw 400 BILLING_WEBHOOK_PAYLOAD_INVALID for non-object payload", async () => {
      await expect(
        subscriptionService.handleBillingWebhookEvent(null)
      ).rejects.toBeInstanceOf(ApiError);

      await expect(
        subscriptionService.handleBillingWebhookEvent(null)
      ).rejects.toMatchObject({
        status: 400,
        code: ERROR_CODES.BILLING_WEBHOOK_PAYLOAD_INVALID,
        reason: "SUBSCRIPTION_WEBHOOK_PAYLOAD_INVALID",
      });
    });

    it("should return handled:false for unsupported event", async () => {
      const payload = {
        event: "SOMETHING_ELSE",
        workspaceId,
      };

      const result =
        await subscriptionService.handleBillingWebhookEvent(payload);

      expect(result).toMatchObject({
        handled: false,
        reason: "UNKNOWN_EVENT",
      });
    });

    it("should throw 400 when ACTIVATED event missing workspaceId/planId", async () => {
      const payload = {
        event: "SUBSCRIPTION_ACTIVATED",
        // workspaceId & planId missing
      };

      await expect(
        subscriptionService.handleBillingWebhookEvent(payload)
      ).rejects.toBeInstanceOf(ApiError);

      await expect(
        subscriptionService.handleBillingWebhookEvent(payload)
      ).rejects.toMatchObject({
        status: 400,
        code: ERROR_CODES.BILLING_WEBHOOK_PAYLOAD_INVALID,
        reason: "SUBSCRIPTION_ACTIVATION_INVALID",
      });
    });

    it("should call startSubscription and return handled:true for valid ACTIVATED event", async () => {
      const spy = vi
        .spyOn(subscriptionService, "startSubscription")
        .mockResolvedValue({ id: "sub_1" });

      const payload = {
        event: "SUBSCRIPTION_ACTIVATED",
        workspaceId,
        planId: "plan_basic",
      };

      const result =
        await subscriptionService.handleBillingWebhookEvent(payload);

      expect(spy).toHaveBeenCalledWith({
        workspaceId,
        planId: "plan_basic",
      });

      expect(result).toMatchObject({
        handled: true,
        action: "SUBSCRIPTION_ACTIVATED",
        workspaceId,
        planId: "plan_basic",
        subscriptionId: "sub_1",
      });

      spy.mockRestore();
    });

    it("should call cancelActiveSubscription and return handled:true for valid CANCELLED event", async () => {
      const spy = vi
        .spyOn(subscriptionService, "cancelActiveSubscription")
        .mockResolvedValue({ id: "sub_2" });

      const payload = {
        event: "SUBSCRIPTION_CANCELLED",
        workspaceId,
      };

      const result =
        await subscriptionService.handleBillingWebhookEvent(payload);

      expect(spy).toHaveBeenCalledWith(workspaceId);

      expect(result).toMatchObject({
        handled: true,
        action: "SUBSCRIPTION_CANCELLED",
        workspaceId,
        subscriptionId: "sub_2",
      });

      spy.mockRestore();
    });
  });
});
