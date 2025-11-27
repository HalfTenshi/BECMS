import express from "express";
import brandController from "../../modules/brand/brand.controller.js";
import { auth } from "../../middlewares/auth.js";
import { workspaceContext } from "../../middlewares/workspace.js";
import { authorize } from "../../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../../modules/rbac/rbac.constants.js";

const r = express.Router();

r.get(
  "/",
  auth,
  workspaceContext,
  authorize(ACTIONS.READ, RESOURCES.BRANDS),
  brandController.getAll
);

r.get(
  "/:id",
  auth,
  workspaceContext,
  authorize(ACTIONS.READ, RESOURCES.BRANDS),
  brandController.getById
);

r.post(
  "/",
  auth,
  workspaceContext,
  authorize(ACTIONS.CREATE, RESOURCES.BRANDS),
  brandController.create
);

r.put(
  "/:id",
  auth,
  workspaceContext,
  authorize(ACTIONS.UPDATE, RESOURCES.BRANDS),
  brandController.update
);

r.delete(
  "/:id",
  auth,
  workspaceContext,
  authorize(ACTIONS.DELETE, RESOURCES.BRANDS),
  brandController.delete
);

export default r;
