// src/routes/contentField.routes.js
import express from "express";
import contentFieldController from "../modules/content/contentField.controller.js";
import { auth } from "../middlewares/auth.js";
import { workspaceContext } from "../middlewares/workspace.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router({ mergeParams: true });
// base path akan dimount di: /api/content/types/:contentTypeId/fields

// Semua route di sini butuh auth + workspace (dari header / query)
router.use(auth, workspaceContext);

// List fields of a ContentType
// GET /api/content/types/:contentTypeId/fields
router.get(
  "/",
  authorize("CONTENT_MODELS", "READ"),
  contentFieldController.list
);

// Get one field
// GET /api/content/types/:contentTypeId/fields/:fieldId
router.get(
  "/:fieldId",
  authorize("CONTENT_MODELS", "READ"),
  contentFieldController.detail
);

// Create field
// POST /api/content/types/:contentTypeId/fields
router.post(
  "/",
  authorize("CONTENT_MODELS", "CREATE"),
  contentFieldController.create
);

// Update field
// PUT /api/content/types/:contentTypeId/fields/:fieldId
router.put(
  "/:fieldId",
  authorize("CONTENT_MODELS", "UPDATE"),
  contentFieldController.update
);

// Delete field
// DELETE /api/content/types/:contentTypeId/fields/:fieldId
router.delete(
  "/:fieldId",
  authorize("CONTENT_MODELS", "DELETE"),
  contentFieldController.remove
);

// Reorder fields (bulk)
// PATCH /api/content/types/:contentTypeId/fields/reorder
router.patch(
  "/reorder",
  authorize("CONTENT_MODELS", "UPDATE"),
  contentFieldController.reorder
);

export default router;
