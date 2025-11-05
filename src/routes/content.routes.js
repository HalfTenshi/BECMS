import express from "express";
import { auth } from "../middlewares/auth.js";

import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";

// import controller
import contentTypeController from "../modules/content/contentType.controller.js";
import contentEntryController from "../modules/content/contentEntry.controller.js";
import fieldValueController from "../modules/content/fieldValue/fieldValue.controller.js";
import contentRelationController from "../modules/content/contentRelation/contentRelation.controller.js";

const router = express.Router();

// Proteksi semua route content builder
router.use(auth, workspaceContext);

/* =========================
   CONTENT TYPE (Model Builder)
   ========================= */
router.get(
  "/types",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_TYPES),
  contentTypeController.getAll
);
router.get(
  "/types/:id",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_TYPES),
  contentTypeController.getById
);
router.post(
  "/types",
  authorize(ACTIONS.CREATE, RESOURCES.CONTENT_TYPES),
  contentTypeController.create
);
router.put(
  "/types/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_TYPES),
  contentTypeController.update
);
router.delete(
  "/types/:id",
  authorize(ACTIONS.DELETE, RESOURCES.CONTENT_TYPES),
  contentTypeController.delete
);

/* =========================
   CONTENT ENTRY (SEO Support)
   ========================= */
router.get(
  "/entries",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.getAll
);
router.get(
  "/entries/:id",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.getById
);
router.post(
  "/entries",
  authorize(ACTIONS.CREATE, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.create
);
router.put(
  "/entries/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.update
);
router.delete(
  "/entries/:id",
  authorize(ACTIONS.DELETE, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.delete
);

// publish entry (workflow approval disederhanakan ke publish)
router.patch(
  "/entries/:id/publish",
  authorize(ACTIONS.PUBLISH, RESOURCES.CONTENT_ENTRIES),
  contentEntryController.publish
);

/* =========================
   FIELD VALUE (Dynamic Fields)
   ========================= */
router.get(
  "/fields/:entryId",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_FIELDS),
  fieldValueController.getByEntry
);
router.post(
  "/fields",
  authorize(ACTIONS.CREATE, RESOURCES.CONTENT_FIELDS),
  fieldValueController.create
);
router.put(
  "/fields/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_FIELDS),
  fieldValueController.update
);
router.delete(
  "/fields/:id",
  authorize(ACTIONS.DELETE, RESOURCES.CONTENT_FIELDS),
  fieldValueController.delete
);

/* =========================
   CONTENT RELATION
   ========================= */
router.get(
  "/relations",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_ENTRIES),
  contentRelationController.getAll
);
router.post(
  "/relations",
  authorize(ACTIONS.CREATE, RESOURCES.CONTENT_ENTRIES),
  contentRelationController.create
);
router.delete(
  "/relations/:id",
  authorize(ACTIONS.DELETE, RESOURCES.CONTENT_ENTRIES),
  contentRelationController.delete
);

export default router;
