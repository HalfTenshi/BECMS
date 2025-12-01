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
  (req, res, next) => brandController.getAll(req, res, next)
);

// Get single brand by id
router.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.BRANDS),
  (req, res, next) => brandController.getById(req, res, next)
);

// Create brand
router.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.BRANDS),
  (req, res, next) => brandController.create(req, res, next)
);

// Update brand
router.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.BRANDS),
  (req, res, next) => brandController.update(req, res, next)
);

// Delete brand
router.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.BRANDS),
  (req, res, next) => brandController.delete(req, res, next)
);

export default router;
