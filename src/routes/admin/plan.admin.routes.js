// src/routes/admin/plan.admin.routes.js
import express from "express";
import planController from "../../modules/plan/plan.controller.js";
import { auth } from "../../middlewares/auth.js";
import workspaceContext from "../../middlewares/workspaceContext.js";
import { authorize } from "../../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../../constants/permissions.js";

const r = express.Router();

// 🔒 Proteksi global: semua plan admin route butuh auth + workspace
r.use(auth, workspaceContext);

r.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.PLANS),
  planController.getAll
);

r.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.PLANS),
  planController.getById
);

r.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.PLANS),
  planController.create
);

r.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.PLANS),
  planController.update
);

r.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.PLANS),
  planController.delete
);

export default r;
