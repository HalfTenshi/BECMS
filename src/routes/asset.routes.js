// src/routes/asset.routes.js
import express from "express";
import { auth } from "../middlewares/auth.js";
import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";
import assetController from "../modules/asset/asset.controller.js";

const router = express.Router();

// 🔒 Media Library = private (per workspace)
router.use(auth, workspaceContext);

// List assets
router.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.ASSETS),
  (req, res) => assetController.list(req, res)
);

// Detail asset
router.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.ASSETS),
  (req, res) => assetController.detail(req, res)
);

// Update metadata (tags, folder, dsb)
router.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.ASSETS),
  (req, res) => assetController.update(req, res)
);

// Delete asset
router.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.ASSETS),
  (req, res) => assetController.remove(req, res)
);

export default router;
