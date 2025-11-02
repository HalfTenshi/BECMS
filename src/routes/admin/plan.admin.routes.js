import express from "express";
import planController from "../../modules/plan/plan.controller.js";
import { auth } from "../../middlewares/auth.js";
import { workspaceContext } from "../../middlewares/workspace.js";
import { authorize } from "../../middlewares/authorize.js";

const r = express.Router();
r.get("/",      auth, workspaceContext, authorize("READ",   "SUBSCRIPTION"), planController.getAll);
r.get("/:id",   auth, workspaceContext, authorize("READ",   "SUBSCRIPTION"), planController.getById);
r.post("/",     auth, workspaceContext, authorize("CREATE", "SUBSCRIPTION"), planController.create);
r.put("/:id",   auth, workspaceContext, authorize("UPDATE", "SUBSCRIPTION"), planController.update);
r.delete("/:id",auth, workspaceContext, authorize("DELETE", "SUBSCRIPTION"), planController.delete);
export default r;
