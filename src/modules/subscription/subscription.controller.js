// src/modules/subscription/subscription.controller.js
import subscriptionService from "./subscription.service.js";

class SubscriptionController {
  async getPlanStatus(req, res) {
    try {
      const workspaceId =
        req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];

      const data = await subscriptionService.getWorkspacePlanStatus(
        workspaceId
      );

      return res.json({ success: true, data });
    } catch (e) {
      return res
        .status(e.status || 400)
        .json({ message: e.message || "Failed to get plan status" });
    }
  }

  async listHistory(req, res) {
    try {
      const workspaceId =
        req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];

      const data = await subscriptionService.listWorkspaceSubscriptions(
        workspaceId
      );

      return res.json({ success: true, data });
    } catch (e) {
      return res
        .status(e.status || 400)
        .json({ message: e.message || "Failed to list subscriptions" });
    }
  }

  async start(req, res) {
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
      return res
        .status(e.status || 400)
        .json({ message: e.message || "Failed to start subscription" });
    }
  }

  async cancelActive(req, res) {
    try {
      const workspaceId =
        req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];

      const data = await subscriptionService.cancelActiveSubscription(
        workspaceId
      );

      return res.json({ success: true, data });
    } catch (e) {
      return res
        .status(e.status || 400)
        .json({ message: e.message || "Failed to cancel subscription" });
    }
  }

  async billingWebhook(req, res) {
    try {
      const result = await subscriptionService.handleBillingWebhookEvent(
        req.body || {}
      );
      return res.json({ success: true, data: result });
    } catch (e) {
      return res
        .status(400)
        .json({ message: e.message || "Failed to handle billing webhook" });
    }
  }
}

export default new SubscriptionController();
