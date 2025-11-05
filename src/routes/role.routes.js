import express from "express";
import { auth } from "../middlewares/auth.js";

import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";

import roleController from "../modules/role/role.controller.js";

const router = express.Router();

// 🔒 Proteksi semua endpoint role (RBAC Admin area)
router.use(auth, workspaceContext);

/* =========================
   ROLE (CRUD)
   ========================= */
router.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.ROLES),
  roleController.getAll
);

router.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.ROLES),
  roleController.getById
);

router.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.ROLES),
  roleController.create
);

router.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.ROLES),
  roleController.update
);

router.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.ROLES),
  roleController.delete
);

/* =========================
   ROLE ↔ PERMISSIONS
   ========================= */
// Tambah permission ke role
router.post(
  "/:id/permissions",
  authorize(ACTIONS.UPDATE, RESOURCES.ROLES),
  roleController.addPermissions
);

// Hapus permission dari role
router.delete(
  "/:id/permissions",
  authorize(ACTIONS.UPDATE, RESOURCES.ROLES),
  roleController.removePermissions
);

export default router;
