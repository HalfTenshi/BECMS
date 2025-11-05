import express from "express";
import { auth } from "../middlewares/auth.js";

import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";

import permissionController from "../modules/role/permission.controller.js";

const router = express.Router();

// 🔒 Proteksi semua endpoint permission (RBAC Admin area)
router.use(auth, workspaceContext);

/* =========================
   PERMISSION (CRUD)
   ========================= */
router.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.PERMISSIONS),
  permissionController.getAll
);

router.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.PERMISSIONS),
  permissionController.getById
);

router.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.PERMISSIONS),
  permissionController.create
);

router.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.PERMISSIONS),
  permissionController.update
);

router.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.PERMISSIONS),
  permissionController.delete
);

export default router;
