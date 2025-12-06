// =========================================================
// src/routes/admin/product.admin.routes.js
// =========================================================

import express from "express";
import productController from "../../modules/product/product.controller.js";
import { auth } from "../../middlewares/auth.js";
import workspaceContext from "../../middlewares/workspaceContext.js";
import { authorize } from "../../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../../constants/permissions.js";

const r = express.Router();

// 🔒 Proteksi global: semua product admin route butuh auth + workspace
r.use(auth, workspaceContext);

r.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.PRODUCTS),
  productController.getAll
);

r.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.PRODUCTS),
  productController.getById
);

r.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.PRODUCTS),
  productController.create
);

r.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.PRODUCTS),
  productController.update
);

r.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.PRODUCTS),
  productController.delete
);

export default r;
