// src/routes/admin/content.admin.routes.js
import express from "express";
import contentTypeController from "../../modules/content/contentType.controller.js";
import contentEntryController from "../../modules/content/contentEntry.controller.js";
import { auth } from "../../middlewares/auth.js";
import workspaceContext from "../../middlewares/workspaceContext.js";
import { authorize } from "../../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../../constants/permissions.js";

const r = express.Router();

// 🔒 Middleware global untuk semua route admin content
r.use(auth, workspaceContext);

// =======================
// 📘 Content Types (CONTENT_TYPES)
// =======================
r.get(
  "/types",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_TYPES),
  contentTypeController.getAll
);

r.get(
  "/types/:id",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_TYPES),
  contentTypeController.getById
);

r.post(
  "/types",
  authorize(ACTIONS.CREATE, RESOURCES.CONTENT_TYPES),
  contentTypeController.create
);

r.put(
  "/types/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_TYPES),
  contentTypeController.update
);

r.delete(
  "/types/:id",
  authorize(ACTIONS.DELETE, RESOURCES.CONTENT_TYPES),
  contentTypeController.delete
);

// =======================
// 📗 Content Entries (CONTENT_ENTRIES)
// =======================
r.get(
  "/entries",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.getAll
);

r.get(
  "/entries/:id",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.getById
);

r.post(
  "/entries",
  authorize(ACTIONS.CREATE, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.create
);

r.put(
  "/entries/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.update
);

r.patch(
  "/entries/:id/publish",
  authorize(ACTIONS.PUBLISH, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.publish
);

r.delete(
  "/entries/:id",
  authorize(ACTIONS.DELETE, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.delete
);

// =======================
// 🧩 Listing dengan filter M2M
// =======================
// GET /api/admin/content/:contentType/entries?fieldId=<REL_FIELD_ID>&related=<ENTRY_ID>&page=1&pageSize=10
r.get(
  "/:contentType/entries",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.listByContentType
);

// 🔎 util search (admin scope)
r.get(
  "/:contentType/search",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.searchForRelation
);

export default r;
