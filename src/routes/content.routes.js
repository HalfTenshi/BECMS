import express from "express";

// import controller
import contentTypeController from "../modules/content/contentType.controller.js";
import contentEntryController from "../modules/content/contentEntry.controller.js";
import fieldValueController from "../modules/content/fieldValue/fieldValue.controller.js";
import contentRelationController from "../modules/content/contentRelation/contentRelation.controller.js";

const router = express.Router();

/* =========================
   CONTENT TYPE (Model Builder)
   ========================= */
router.get("/types", contentTypeController.getAll);
router.get("/types/:id", contentTypeController.getById);
router.post("/types", contentTypeController.create);
router.put("/types/:id", contentTypeController.update);
router.delete("/types/:id", contentTypeController.delete);

/* =========================
   CONTENT ENTRY (SEO Support)
   ========================= */
router.get("/entries", contentEntryController.getAll);
router.get("/entries/:id", contentEntryController.getById);
router.post("/entries", contentEntryController.create);
router.put("/entries/:id", contentEntryController.update);
router.delete("/entries/:id", contentEntryController.delete);

// publish entry (workflow approval disederhanakan ke publish)
router.patch("/entries/:id/publish", contentEntryController.publish);

/* =========================
   FIELD VALUE (Dynamic Fields)
   ========================= */
router.get("/fields/:entryId", fieldValueController.getByEntry);
router.post("/fields", fieldValueController.create);
router.put("/fields/:id", fieldValueController.update);
router.delete("/fields/:id", fieldValueController.delete);

/* =========================
   CONTENT RELATION
   ========================= */
router.get("/relations", contentRelationController.getAll);
router.post("/relations", contentRelationController.create);
router.delete("/relations/:id", contentRelationController.delete);

export default router;
