import express from "express";
import brandController from "../../modules/brand/brand.controller.js";
import { auth } from "../../middlewares/auth.js";
import { workspaceContext } from "../../middlewares/workspace.js";
import { authorize } from "../../middlewares/authorize.js";

const r = express.Router();
r.get("/",      auth, workspaceContext, authorize("READ",   "BRAND"),   brandController.getAll);
r.get("/:id",   auth, workspaceContext, authorize("READ",   "BRAND"),   brandController.getById);
r.post("/",     auth, workspaceContext, authorize("CREATE", "BRAND"),   brandController.create);
r.put("/:id",   auth, workspaceContext, authorize("UPDATE", "BRAND"),   brandController.update);
r.delete("/:id",auth, workspaceContext, authorize("DELETE", "BRAND"),   brandController.delete);
export default r;
