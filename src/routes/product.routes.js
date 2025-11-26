// src/routes/product.routes.js
import express from "express";
import { auth } from "../middlewares/auth.js";
import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";

import productController from "../modules/product/product.controller.js";

const router = express.Router();

// 🔒 Proteksi semua route product dengan auth + workspace + RBAC
router.use(auth, workspaceContext);

/* =========================
   PRODUCT ROUTES (CRUD)
   ========================= */
router.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.PRODUCTS),
  productController.getAll
);

router.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.PRODUCTS),
  productController.getById
);

router.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.PRODUCTS),
  productController.create
);

router.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.PRODUCTS),
  productController.update
);

router.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.PRODUCTS),
  productController.delete
);

export default router;
