import express from "express";
import workspaceController from "../modules/workspace/workspace.controller.js";
import memberRoutes from "./member.routes.js";

const router = express.Router();

router.get("/", workspaceController.getAll);
router.get("/:id", workspaceController.getById);
router.post("/", workspaceController.create);
router.put("/:id", workspaceController.update);
router.delete("/:id", workspaceController.delete);

// NESTED: /api/workspaces/:workspaceId/members/...
router.use("/:workspaceId/members", memberRoutes);

export default router;
