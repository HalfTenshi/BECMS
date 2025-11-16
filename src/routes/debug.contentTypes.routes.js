// src/routes/debug.contentTypes.routes.js
import express from "express";
import prisma from "../config/prismaClient.js";

const router = express.Router();

router.get("/content-types", async (req, res, next) => {
  try {
    const cts = await prisma.contentType.findMany({
      select: { id: true, apiKey: true, workspaceId: true },
    });
    res.json(cts);
  } catch (e) {
    next(e);
  }
});

export default router;
