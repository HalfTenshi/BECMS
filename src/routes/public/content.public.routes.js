import express from "express";
import prisma from "../../config/prismaClient.js";
import { workspaceContext } from "../../middlewares/workspace.js";
import contentEntryController from "../../modules/content/contentEntry.controller.js";

const r = express.Router();

// List entries by contentType apiKey (published only)
r.get("/:apiKey", workspaceContext, async (req, res) => {
  try {
    const { apiKey } = req.params;
    const { workspaceId } = req.ctx;

    const type = await prisma.contentType.findFirst({
      where: { workspaceId, apiKey },
      select: { id: true },
    });
    if (!type) return res.status(404).json({ error: "Content type not found" });

    const items = await prisma.contentEntry.findMany({
      where: { workspaceId, contentTypeId: type.id, isPublished: true },
      orderBy: { publishedAt: "desc" },
      include: { values: true },
    });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get by slug (published only)
r.get("/:apiKey/:slug", workspaceContext, async (req, res) => {
  try {
    const { apiKey, slug } = req.params;
    const { workspaceId } = req.ctx;

    const type = await prisma.contentType.findFirst({
      where: { workspaceId, apiKey },
      select: { id: true },
    });
    if (!type) return res.status(404).json({ error: "Content type not found" });

    const item = await prisma.contentEntry.findFirst({
      where: { workspaceId, contentTypeId: type.id, slug, isPublished: true },
      include: { values: true },
    });
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});
r.get("/:contentType/search", workspaceContext, contentEntryController.searchForRelation);

export default r;
