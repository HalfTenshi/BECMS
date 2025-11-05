import express from "express";
import { auth } from "../middlewares/auth.js";

import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";

import planController from "../modules/plan/plan.controller.js";

const router = express.Router();

// 🔒 Lindungi semua endpoint plan
router.use(auth, workspaceContext);

/* =========================
   PLAN (Subscription Package)
   ========================= */
router.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.PLANS),
  planController.getAll
);

router.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.PLANS),
  planController.getById
);

router.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.PLANS),
  planController.create
);

router.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.PLANS),
  planController.update
);

router.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.PLANS),
  planController.delete
);

export default router;
