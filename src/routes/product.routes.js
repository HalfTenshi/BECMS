// =========================================================
// src/routes/product.routes.js
// =========================================================

import express from "express";
import { auth } from "../middlewares/auth.js";
import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";

import productController from "../modules/product/product.controller.js";

const router = express.Router();

// 🔒 Semua route product: butuh auth + workspace + RBAC
router.use(auth, workspaceContext);

/* =========================
   PRODUCT ROUTES (CRUD)
   ========================= */

// List products in workspace
router.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.PRODUCTS),
  (req, res, next) => productController.getAll(req, res, next)
);

// Get single product by id
router.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.PRODUCTS),
  (req, res, next) => productController.getById(req, res, next)
);

// Create product
router.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.PRODUCTS),
  (req, res, next) => productController.create(req, res, next)
);

// Update product
router.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.PRODUCTS),
  (req, res, next) => productController.update(req, res, next)
);

// Delete product
router.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.PRODUCTS),
  (req, res, next) => productController.delete(req, res, next)
);

export default router;
