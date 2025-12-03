// src/routes/debug.contentTypes.routes.js
import express from "express";
import prisma from "../config/prismaClient.js";

import { auth } from "../middlewares/auth.js";
import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";

const router = express.Router();

// 🔒 Debug endpoint tetap diproteksi auth + workspace + RBAC (READ CONTENT_TYPES)
router.use(auth, workspaceContext);

router.get(
  "/content-types",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_TYPES),
  async (req, res, next) => {
    try {
      const cts = await prisma.contentType.findMany({
        select: { id: true, apiKey: true, workspaceId: true },
      });
      res.json(cts);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
