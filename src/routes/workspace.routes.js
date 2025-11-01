import express from "express";
import workspaceController from "../modules/workspace/workspace.controller.js";

const router = express.Router();

router.get("/", workspaceController.getAll);
router.get("/:id", workspaceController.getById);
router.post("/", workspaceController.create);
router.put("/:id", workspaceController.update);
router.delete("/:id", workspaceController.delete);

export default router;
