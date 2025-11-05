import express from "express";
import { auth } from "../middlewares/auth.js";
import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";
import userController from "../modules/user/user.controller.js";

const router = express.Router();

// 🔒 Semua endpoint user butuh auth + workspace + RBAC
router.use(auth, workspaceContext);

// List users (search, status, page, limit)
router.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.USERS),
  userController.getAll
);

// Get user by id
router.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.USERS),
  userController.getById
);

// Create user
router.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.USERS),
  userController.create
);

// Update profile fields
router.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.USERS),
  userController.update
);

// Update status only
router.patch(
  "/:id/status",
  authorize(ACTIONS.UPDATE, RESOURCES.USERS),
  userController.updateStatus
);

// Delete user
router.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.USERS),
  userController.delete
);

export default router;
