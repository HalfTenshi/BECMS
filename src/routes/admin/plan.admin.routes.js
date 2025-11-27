import express from "express";
import planController from "../../modules/plan/plan.controller.js";
import { auth } from "../../middlewares/auth.js";
import { workspaceContext } from "../../middlewares/workspace.js";
import { authorize } from "../../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../../modules/rbac/rbac.constants.js";

const r = express.Router();

r.get(
  "/",
  auth,
  workspaceContext,
  authorize(ACTIONS.READ, RESOURCES.PLANS),
  planController.getAll
);

r.get(
  "/:id",
  auth,
  workspaceContext,
  authorize(ACTIONS.READ, RESOURCES.PLANS),
  planController.getById
);

r.post(
  "/",
  auth,
  workspaceContext,
  authorize(ACTIONS.CREATE, RESOURCES.PLANS),
  planController.create
);

r.put(
  "/:id",
  auth,
  workspaceContext,
  authorize(ACTIONS.UPDATE, RESOURCES.PLANS),
  planController.update
);

r.delete(
  "/:id",
  auth,
  workspaceContext,
  authorize(ACTIONS.DELETE, RESOURCES.PLANS),
  planController.delete
);

export default r;
