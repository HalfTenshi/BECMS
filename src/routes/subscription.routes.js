// src/routes/subscription.routes.js
import express from "express";
import { auth } from "../middlewares/auth.js";
import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";
import subscriptionController from "../modules/subscription/subscription.controller.js";

const router = express.Router();

// 🔒 Semua endpoint subscription bersifat admin (per workspace)
router.use(auth, workspaceContext);

// GET /api/admin/subscription/plan
router.get(
  "/plan",
  authorize(ACTIONS.READ, RESOURCES.WORKSPACES),
  (req, res) => subscriptionController.getPlanStatus(req, res)
);

// GET /api/admin/subscription/history
router.get(
  "/history",
  authorize(ACTIONS.READ, RESOURCES.WORKSPACES),
  (req, res) => subscriptionController.listHistory(req, res)
);

// POST /api/admin/subscription
// Body: { planId }
router.post(
  "/",
  authorize(ACTIONS.UPDATE, RESOURCES.WORKSPACES),
  (req, res) => subscriptionController.start(req, res)
);

// POST /api/admin/subscription/cancel-active
router.post(
  "/cancel-active",
  authorize(ACTIONS.UPDATE, RESOURCES.WORKSPACES),
  (req, res) => subscriptionController.cancelActive(req, res)
);

export default router;
