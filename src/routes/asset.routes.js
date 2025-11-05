import express from "express";
import auth from "../middlewares/auth.js";
import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";
import assetController from "../modules/asset/asset.controller.js";

const router = express.Router();
// 🔒 Media Library = private
router.use(auth, workspaceContext);

router.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.ASSETS),
  assetController.list
);
router.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.ASSETS),
  assetController.detail
);
router.put(
  "//:id",
  authorize(ACTIONS.UPDATE, RESOURCES.ASSETS),
  assetController.update
);
router.delete(
  "//:id",
  authorize(ACTIONS.DELETE, RESOURCES.ASSETS),
  assetController.remove
);

export default router;
