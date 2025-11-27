// src/modules/billing/billing.controller.js
// @ts-nocheck

import xenditBillingService from "./xendit.service.js";

class BillingController {
  /**
   * POST /api/admin/billing/checkout/:planId
   *
   * Body:
   * {
   *   "amount": 99000,
   *   "currency": "IDR",           // optional, default "IDR"
   *   "customer": { ... },         // optional, di-pass ke Xendit
   *   "successRedirectUrl": "...", // optional
   *   "failureRedirectUrl": "..."  // optional
   * }
   *
   * Response (berhasil):
   * {
   *   "success": true,
   *   "data": {
   *     "invoiceId": "...",
   *     "externalId": "...",
   *     "status": "PENDING",
   *     "invoiceUrl": "https://checkout.xendit.co/....",
   *     "amount": 99000,
   *     "currency": "IDR"
   *   }
   * }
   */
  async checkout(req, res) {
    try {
      const workspaceId =
        req.workspace?.id ||
        req.workspaceId ||
        req.headers["x-workspace-id"];

      const { planId } = req.params;
      const {
        amount,
        currency,
        customer,
        successRedirectUrl,
        failureRedirectUrl,
      } = req.body || {};

      if (!workspaceId) {
        return res
          .status(400)
          .json({ success: false, message: "workspaceId is required" });
      }

      if (!planId) {
        return res
          .status(400)
          .json({ success: false, message: "planId is required" });
      }

      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: "amount must be a positive number",
        });
      }

      const invoice = await xenditBillingService.createInvoice({
        workspaceId,
        planId,
        amount,
        currency,
        description: `Subscription BECMS - Plan ${planId}`,
        successRedirectUrl,
        failureRedirectUrl,
        customer,
      });

      return res.status(201).json({
        success: true,
        data: {
          invoiceId: invoice.id,
          externalId: invoice.external_id,
          status: invoice.status,
          invoiceUrl: invoice.invoice_url,
          amount: invoice.amount,
          currency: invoice.currency,
        },
      });
    } catch (err) {
      console.error("Billing checkout error:", err);
      return res.status(err.status || 500).json({
        success: false,
        message: err.message || "Failed to create invoice",
      });
    }
  }
}

export default new BillingController();
