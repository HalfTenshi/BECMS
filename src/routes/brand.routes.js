import express from "express";
import { auth } from "../middlewares/auth.js";

import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";

import brandController from "../modules/brand/brand.controller.js";

const router = express.Router();

// 🔒 Proteksi seluruh route brand dengan auth + workspace + RBAC
router.use(auth, workspaceContext);

/* =========================
   BRAND ROUTES (CRUD)
   ========================= */
router.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.BRANDS),
  brandController.getAll
);

router.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.BRANDS),
  brandController.getById
);

router.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.BRANDS),
  brandController.create
);

router.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.BRANDS),
  brandController.update
);

router.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.BRANDS),
  brandController.delete
);

export default router;
