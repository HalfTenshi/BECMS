// =========================================================
// src/modules/subscription/subscription.service.js
// =========================================================

import prisma from "../../config/prismaClient.js";
import subscriptionRepository from "./subscription.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

class SubscriptionService {
  /**
   * Ambil status plan + subscription + usage untuk satu workspace.
   * Dipakai FE buat menampilkan:
   * - nama plan & limit
   * - status subscription (ACTIVE/CANCELLED/EXPIRED)
   * - pemakaian: members, contentTypes, entries
   */
  async getWorkspacePlanStatus(workspaceId) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.WORKSPACE_REQUIRED,
        reason: "SUBSCRIPTION_WORKSPACE_ID_REQUIRED",
      });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        plan: {
          select: {
            id: true,
            name: true,
            maxMembers: true,
            maxContentTypes: true,
            maxEntries: true,
          },
        },
      },
    });

    if (!workspace) {
      throw ApiError.notFound("Workspace not found", {
        code: ERROR_CODES.WORKSPACE_NOT_FOUND,
        reason: "SUBSCRIPTION_WORKSPACE_NOT_FOUND",
        resource: "WORKSPACES",
        details: { workspaceId },
      });
    }

    const [activeSub, memberCount, contentTypeCount, entryCount] =
      await Promise.all([
        subscriptionRepository.getActiveByWorkspace(workspaceId),
        prisma.workspaceMember.count({ where: { workspaceId } }),
        prisma.contentType.count({ where: { workspaceId } }),
        prisma.contentEntry.count({ where: { workspaceId } }),
      ]);

    const plan = workspace.plan || null;

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      plan: plan
        ? {
            id: plan.id,
            name: plan.name,
            maxMembers: plan.maxMembers,
            maxContentTypes: plan.maxContentTypes,
            maxEntries: plan.maxEntries,
          }
        : null,
      subscription: activeSub
        ? {
            id: activeSub.id,
            status: activeSub.status,
            startedAt: activeSub.startedAt,
            cancelledAt: activeSub.cancelledAt,
            expiredAt: activeSub.expiredAt,
            planId: activeSub.planId,
          }
        : null,
      usage: {
        members: {
          current: memberCount,
          max: plan?.maxMembers ?? null,
        },
        contentTypes: {
          current: contentTypeCount,
          max: plan?.maxContentTypes ?? null,
        },
        entries: {
          current: entryCount,
          max: plan?.maxEntries ?? null,
        },
      },
    };
  }

  /**
   * History subscription per workspace (untuk halaman billing).
   */
  async listWorkspaceSubscriptions(workspaceId) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.WORKSPACE_REQUIRED,
        reason: "SUBSCRIPTION_WORKSPACE_ID_REQUIRED",
      });
    }

    const subs = await subscriptionRepository.listByWorkspace(workspaceId);
    return subs;
  }

  /**
   * Start / change subscription plan untuk workspace.
   *
   * Behaviour:
   * - Expire semua ACTIVE subscription sebelumnya.
   * - Buat subscription baru dengan status ACTIVE.
   * - Update Workspace.planId = planId baru.
   */
  async startSubscription({ workspaceId, planId }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.WORKSPACE_REQUIRED,
        reason: "SUBSCRIPTION_WORKSPACE_ID_REQUIRED",
      });
    }
    if (!planId) {
      throw ApiError.badRequest("planId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "SUBSCRIPTION_PLAN_ID_REQUIRED",
        details: { workspaceId },
      });
    }

    // Pastikan workspace & plan ada
    const [workspace, plan] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      }),
      prisma.plan.findUnique({
        where: { id: planId },
        select: { id: true },
      }),
    ]);

    if (!workspace) {
      throw ApiError.notFound("Workspace not found", {
        code: ERROR_CODES.WORKSPACE_NOT_FOUND,
        reason: "SUBSCRIPTION_WORKSPACE_NOT_FOUND",
        resource: "WORKSPACES",
        details: { workspaceId },
      });
    }

    if (!plan) {
      throw ApiError.notFound("Plan not found", {
        code: ERROR_CODES.PLAN_NOT_FOUND,
        reason: "SUBSCRIPTION_PLAN_NOT_FOUND",
        resource: "PLANS",
        details: { workspaceId, planId },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Expire semua ACTIVE sebelumnya
      await subscriptionRepository.expireAllActive(workspaceId, tx);

      // Buat subscription baru
      const newSub = await subscriptionRepository.create(
        {
          workspaceId,
          planId,
          status: "ACTIVE",
          startedAt: new Date(),
        },
        tx
      );

      // Update workspace.planId
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { planId },
      });

      return newSub;
    });

    return result;
  }

  /**
   * Batalkan subscription aktif (misal ketika billing gagal / user cancel).
   */
  async cancelActiveSubscription(workspaceId) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.WORKSPACE_REQUIRED,
        reason: "SUBSCRIPTION_WORKSPACE_ID_REQUIRED",
      });
    }

    const active = await subscriptionRepository.getActiveByWorkspace(
      workspaceId
    );

    if (!active) {
      throw ApiError.notFound("No active subscription", {
        code: ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
        reason: "SUBSCRIPTION_ACTIVE_NOT_FOUND",
        resource: "SUBSCRIPTIONS",
        details: { workspaceId },
      });
    }

    const updated = await subscriptionRepository.updateStatus(active.id, {
      status: "CANCELLED",
      cancelledAt: new Date(),
    });

    return updated;
  }

  /**
   * Handler utama untuk webhook billing (Xendit).
   *
   * Mapping yang kita dukung:
   *
   * 1) SHAPE XENDIT INVOICE (disarankan):
   *    - payload.status: "PAID" | "EXPIRED" | "VOIDED" | "REFUNDED" | ...
   *    - payload.metadata:
   *        {
   *          workspaceId: "<UUID workspace BECMS>",
   *          planId: "<UUID plan BECMS>",
   *          event?: "SUBSCRIPTION_ACTIVATED" | "SUBSCRIPTION_CANCELLED"
   *        }
   *
   *    a) Kalau metadata.event ada → pakai langsung.
   *    b) Kalau tidak ada:
   *       - status "PAID"        → SUBSCRIPTION_ACTIVATED
   *       - status "EXPIRED"     → SUBSCRIPTION_CANCELLED
   *       - status "VOIDED"      → SUBSCRIPTION_CANCELLED
   *       - status "REFUNDED"    → SUBSCRIPTION_CANCELLED
   *
   * 2) SHAPE CUSTOM INTERNAL (opsional):
   *    - payload.event: "SUBSCRIPTION_ACTIVATED" | "SUBSCRIPTION_CANCELLED"
   *    - payload.workspaceId, payload.planId
   */
  async handleBillingWebhookEvent(payload) {
    // Safety: pastikan payload object
    if (!payload || typeof payload !== "object") {
      throw ApiError.badRequest("Invalid webhook payload", {
        code: ERROR_CODES.BILLING_WEBHOOK_PAYLOAD_INVALID,
        reason: "SUBSCRIPTION_WEBHOOK_PAYLOAD_INVALID",
      });
    }

    // --- Extract dari beberapa kemungkinan shape ---

    const metadata = payload.metadata || {};
    let event =
      payload.event ||
      metadata.event ||
      null;

    // Workspace & plan id bisa disimpan di metadata atau top-level
    const workspaceId =
      metadata.workspaceId || payload.workspaceId || null;
    const planId =
      metadata.planId || payload.planId || null;

    // Kalau event belum ada, derive dari status Xendit invoice
    // Contoh status: "PENDING", "PAID", "EXPIRED"
    if (!event && payload.status) {
      const status = String(payload.status).toUpperCase();

      if (status === "PAID") {
        event = "SUBSCRIPTION_ACTIVATED";
      } else if (
        status === "EXPIRED" ||
        status === "VOIDED" ||
        status === "REFUNDED" ||
        status === "FAILED"
      ) {
        event = "SUBSCRIPTION_CANCELLED";
      }
    }

    // Kalau masih belum dapat event, kita anggap tidak support
    if (!event) {
      return {
        handled: false,
        reason: "UNSUPPORTED_EVENT",
        details: {
          note: "Cannot derive subscription event from payload",
        },
      };
    }

    // --- Handle event yang kita support ---

    if (event === "SUBSCRIPTION_ACTIVATED") {
      if (!workspaceId || !planId) {
        throw ApiError.badRequest(
          "workspaceId and planId are required for activation",
          {
            code: ERROR_CODES.BILLING_WEBHOOK_PAYLOAD_INVALID,
            reason: "SUBSCRIPTION_ACTIVATION_INVALID",
            details: { workspaceId, planId, event },
          }
        );
      }

      const sub = await this.startSubscription({ workspaceId, planId });

      return {
        handled: true,
        action: "SUBSCRIPTION_ACTIVATED",
        workspaceId,
        planId,
        subscriptionId: sub.id,
      };
    }

    if (event === "SUBSCRIPTION_CANCELLED") {
      if (!workspaceId) {
        throw ApiError.badRequest(
          "workspaceId is required for cancellation",
          {
            code: ERROR_CODES.BILLING_WEBHOOK_PAYLOAD_INVALID,
            reason: "SUBSCRIPTION_CANCELLATION_INVALID",
            details: { workspaceId, event },
          }
        );
      }

      const sub = await this.cancelActiveSubscription(workspaceId);

      return {
        handled: true,
        action: "SUBSCRIPTION_CANCELLED",
        workspaceId,
        subscriptionId: sub.id,
      };
    }

    // Fallback: event tidak dikenal
    return {
      handled: false,
      reason: "UNKNOWN_EVENT",
      event,
    };
  }
}

export default new SubscriptionService();
