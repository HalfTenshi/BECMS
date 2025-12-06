// =========================================================
// src/routes/admin/brand.admin.routes.js
// =========================================================

import express from "express";
import brandController from "../../modules/brand/brand.controller.js";
import { auth } from "../../middlewares/auth.js";
import workspaceContext from "../../middlewares/workspaceContext.js";
import { authorize } from "../../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../../constants/permissions.js";

const r = express.Router();

// 🔒 Proteksi global: semua route brand admin butuh auth + workspace
r.use(auth, workspaceContext);

r.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.BRANDS),
  brandController.getAll
);

r.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.BRANDS),
  brandController.getById
);

r.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.BRANDS),
  brandController.create
);

r.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.BRANDS),
  brandController.update
);

r.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.BRANDS),
  brandController.delete
);

export default r;
