import express from "express";
import productController from "../../modules/product/product.controller.js";
import { auth } from "../../middlewares/auth.js";
import { workspaceContext } from "../../middlewares/workspace.js";
import { authorize } from "../../middlewares/authorize.js";

const r = express.Router();
r.get("/",      auth, workspaceContext, authorize("READ",   "PRODUCT"), productController.getAll);
r.get("/:id",   auth, workspaceContext, authorize("READ",   "PRODUCT"), productController.getById);
r.post("/",     auth, workspaceContext, authorize("CREATE", "PRODUCT"), productController.create);
r.put("/:id",   auth, workspaceContext, authorize("UPDATE", "PRODUCT"), productController.update);
r.delete("/:id",auth, workspaceContext, authorize("DELETE", "PRODUCT"), productController.delete);
export default r;
