import express from "express";
import contentFieldController from "../modules/content/contentField.controller.js";
import { auth } from "../middlewares/auth.js";
import { workspaceGuard } from "../middlewares/workspace.js"; // asumsi: set req.workspaceId

const router = express.Router({ mergeParams: true });
// base path akan dimount di: /api/content/types/:contentTypeId/fields

router.use(auth, workspaceGuard);

// List fields of a ContentType
router.get("/", contentFieldController.list);

// Get one field
router.get("/:fieldId", contentFieldController.detail);

// Create field
router.post("/", contentFieldController.create);

// Update field
router.put("/:fieldId", contentFieldController.update);

// Delete field
router.delete("/:fieldId", contentFieldController.remove);

// Reorder fields (bulk)
router.patch("/reorder", contentFieldController.reorder);

export default router;
