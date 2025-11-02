import express from "express";
import contentTypeController from "../../modules/content/contentType.controller.js";
import contentEntryController from "../../modules/content/contentEntry.controller.js";
import { auth } from "../../middlewares/auth.js";
import { workspaceContext } from "../../middlewares/workspace.js";
import { authorize } from "../../middlewares/authorize.js";

const r = express.Router();

// Content Types (CONTENT_MODELS)
r.get("/types",      auth, workspaceContext, authorize("READ",   "CONTENT_MODELS"),   contentTypeController.getAll);
r.get("/types/:id",  auth, workspaceContext, authorize("READ",   "CONTENT_MODELS"),   contentTypeController.getById);
r.post("/types",     auth, workspaceContext, authorize("CREATE", "CONTENT_MODELS"),   contentTypeController.create);
r.put("/types/:id",  auth, workspaceContext, authorize("UPDATE", "CONTENT_MODELS"),   contentTypeController.update);
r.delete("/types/:id",auth,workspaceContext, authorize("DELETE", "CONTENT_MODELS"),   contentTypeController.delete);

// Content Entries (CONTENT_ENTRIES)
r.get("/entries",         auth, workspaceContext, authorize("READ",    "CONTENT_ENTRIES"), contentEntryController.getAll);
r.get("/entries/:id",     auth, workspaceContext, authorize("READ",    "CONTENT_ENTRIES"), contentEntryController.getById);
r.post("/entries",        auth, workspaceContext, authorize("CREATE",  "CONTENT_ENTRIES"), contentEntryController.create);
r.put("/entries/:id",     auth, workspaceContext, authorize("UPDATE",  "CONTENT_ENTRIES"), contentEntryController.update);
r.patch("/entries/:id/publish", auth, workspaceContext, authorize("PUBLISH","CONTENT_ENTRIES"), contentEntryController.publish);
r.delete("/entries/:id",  auth, workspaceContext, authorize("DELETE",  "CONTENT_ENTRIES"), contentEntryController.delete);

export default r;
