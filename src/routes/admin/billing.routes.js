// src/routes/admin/billing.routes.js
// @ts-nocheck

import express from "express";
import { auth } from "../../middlewares/auth.js";
import workspaceContext from "../../middlewares/workspaceContext.js";
import { authorize } from "../../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../../constants/permissions.js";
import billingController from "../../modules/billing/billing.controller.js";

const router = express.Router();

// 🔒 Semua endpoint billing = admin-only, butuh auth + workspace
router.use(auth, workspaceContext);

/**
 * POST /api/admin/billing/checkout/:planId
 *
 * Body:
 * {
 *   "amount": 99000,
 *   "currency": "IDR",
 *   "customer": { ... },
 *   "successRedirectUrl": "...",
 *   "failureRedirectUrl": "..."
 * }
 */
router.post(
  "/checkout/:planId",
  authorize(ACTIONS.UPDATE, RESOURCES.WORKSPACES),
  (req, res) => billingController.checkout(req, res)
);

export default router;
