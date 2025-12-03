// src/routes/workspace.routes.js
import express from "express";

import { auth } from "../middlewares/auth.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";

import workspaceController from "../modules/workspace/workspace.controller.js";
import memberRoutes from "./member.routes.js";

const router = express.Router();

// helper: ambil workspaceId dari param dan pasang ke req.workspace
const attachWsFromParam = (paramName) => (req, _res, next) => {
  req.workspace = req.workspace || {};
  req.workspace.id = req.params[paramName];
  next();
};

/* =========================
   WORKSPACES (global scope)
   ========================= */
// 🔒 Hanya auth (tidak butuh workspaceId). Bisa ditambah RBAC kalau mau.
router.get("/", auth, workspaceController.getAll);

router.post(
  "/",
  auth,
  // opsional: jika ingin batasi siapa yg bisa create workspace, aktifkan authorize berikut:
  // authorize(ACTIONS.CREATE, RESOURCES.WORKSPACES),
  workspaceController.create
);

/* =========================
   WORKSPACE (by :id) — butuh RBAC
   ========================= */
router.get(
  "/:id",
  auth,
  attachWsFromParam("id"),
  authorize(ACTIONS.READ, RESOURCES.WORKSPACES),
  workspaceController.getById
);

router.put(
  "/:id",
  auth,
  attachWsFromParam("id"),
  authorize(ACTIONS.UPDATE, RESOURCES.WORKSPACES),
  workspaceController.update
);

router.delete(
  "/:id",
  auth,
  attachWsFromParam("id"),
  authorize(ACTIONS.DELETE, RESOURCES.WORKSPACES),
  workspaceController.delete
);

/* =========================
   NESTED: /api/workspaces/:workspaceId/members/...
   ========================= */
router.use(
  "/:workspaceId/members",
  auth,
  attachWsFromParam("workspaceId"),
  // Mengelola member = hak UPDATE pada WORKSPACES
  authorize(ACTIONS.UPDATE, RESOURCES.WORKSPACES),
  memberRoutes
);

export default router;
