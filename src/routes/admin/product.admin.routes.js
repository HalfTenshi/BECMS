import express from "express";
import productController from "../../modules/product/product.controller.js";
import { auth } from "../../middlewares/auth.js";
import { workspaceContext } from "../../middlewares/workspace.js";
import { authorize } from "../../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../../modules/rbac/rbac.constants.js";

const r = express.Router();

r.get(
  "/",
  auth,
  workspaceContext,
  authorize(ACTIONS.READ, RESOURCES.PRODUCTS),
  productController.getAll
);

r.get(
  "/:id",
  auth,
  workspaceContext,
  authorize(ACTIONS.READ, RESOURCES.PRODUCTS),
  productController.getById
);

r.post(
  "/",
  auth,
  workspaceContext,
  authorize(ACTIONS.CREATE, RESOURCES.PRODUCTS),
  productController.create
);

r.put(
  "/:id",
  auth,
  workspaceContext,
  authorize(ACTIONS.UPDATE, RESOURCES.PRODUCTS),
  productController.update
);

r.delete(
  "/:id",
  auth,
  workspaceContext,
  authorize(ACTIONS.DELETE, RESOURCES.PRODUCTS),
  productController.delete
);

export default r;
