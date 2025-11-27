// src/routes/contentField.routes.js
import express from "express";
import contentFieldController from "../modules/content/contentField.controller.js";
import { auth } from "../middlewares/auth.js";
import { workspaceContext } from "../middlewares/workspace.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../modules/rbac/rbac.constants.js";

const router = express.Router({ mergeParams: true });
// base path akan dimount di: /api/content/types/:contentTypeId/fields

// Semua route di sini butuh auth + workspace (dari header / query)
router.use(auth, workspaceContext);

// List fields of a ContentType
// GET /api/content/types/:contentTypeId/fields
router.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_FIELDS),
  contentFieldController.list
);

// Get one field
// GET /api/content/types/:contentTypeId/fields/:fieldId
router.get(
  "/:fieldId",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_FIELDS),
  contentFieldController.detail
);

// Create field
// POST /api/content/types/:contentTypeId/fields
router.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.CONTENT_FIELDS),
  contentFieldController.create
);

// Update field
// PUT /api/content/types/:contentTypeId/fields/:fieldId
router.put(
  "/:fieldId",
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_FIELDS),
  contentFieldController.update
);

// Delete field
// DELETE /api/content/types/:contentTypeId/fields/:fieldId
router.delete(
  "/:fieldId",
  authorize(ACTIONS.DELETE, RESOURCES.CONTENT_FIELDS),
  contentFieldController.remove
);

// Reorder fields (bulk)
// PATCH /api/content/types/:contentTypeId/fields/reorder
router.patch(
  "/reorder",
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_FIELDS),
  contentFieldController.reorder
);

export default router;
