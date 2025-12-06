// =========================================================
// src/modules/subscription/subscription.controller.js
// =========================================================

import subscriptionService from "./subscription.service.js";

class SubscriptionController {
  async getPlanStatus(req, res, next) {
    try {
      const workspaceId =
        req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];

      const data = await subscriptionService.getWorkspacePlanStatus(
        workspaceId
      );

      return res.json({ success: true, data });
    } catch (e) {
      return next(e);
    }
  }

  async listHistory(req, res, next) {
    try {
      const workspaceId =
        req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];

      const data = await subscriptionService.listWorkspaceSubscriptions(
        workspaceId
      );

      return res.json({ success: true, data });
    } catch (e) {
      return next(e);
    }
  }

  async start(req, res, next) {
    try {
      const workspaceId =
        req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];
      const { planId } = req.body || {};

      const data = await subscriptionService.startSubscription({
        workspaceId,
        planId,
      });

      return res.status(201).json({ success: true, data });
    } catch (e) {
      return next(e);
    }
  }

  async cancelActive(req, res, next) {
    try {
      const workspaceId =
        req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];

      const data = await subscriptionService.cancelActiveSubscription(
        workspaceId
      );

      return res.json({ success: true, data });
    } catch (e) {
      return next(e);
    }
  }

  async billingWebhook(req, res, next) {
    try {
      const result = await subscriptionService.handleBillingWebhookEvent(
        req.body || {}
      );
      return res.json({ success: true, data: result });
    } catch (e) {
      return next(e);
    }
  }
}

export default new SubscriptionController();
