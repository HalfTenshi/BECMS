// =========================================================
// src/routes/brand.routes.js
// =========================================================

import express from "express";
import { auth } from "../middlewares/auth.js";
import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";

import brandController from "../modules/brand/brand.controller.js";

const router = express.Router();

// 🔒 Semua route brand: butuh auth + workspace + RBAC
router.use(auth, workspaceContext);

/* =========================
   BRAND ROUTES (CRUD)
   ========================= */

// List brands in workspace
router.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.BRANDS),
  brandController.getAll
);

// Get single brand by id
router.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.BRANDS),
  brandController.getById
);

// Create brand
router.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.BRANDS),
  brandController.create
);

// Update brand
router.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.BRANDS),
  brandController.update
);

// Delete brand
router.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.BRANDS),
  brandController.delete
);

export default router;
