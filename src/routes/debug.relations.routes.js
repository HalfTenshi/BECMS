// src/routes/debug.relations.routes.js
import express from "express";
import prisma from "../config/prismaClient.js";
import { expandRelations } from "../modules/content/relations.expander.js";

const router = express.Router();

/**
 * GET /api/debug/relations/:contentTypeApiKey/:slug
 *
 * Query:
 *  - workspaceId?   (optional, kalau mau pakai ID)
 *  - workspaceSlug? (optional, lebih nyaman: contoh "becms")
 *  - depth?         (default: 1)
 *  - summary?       ("basic" | "full", default: "basic")
 *
 * Contoh:
 *  GET http://localhost:3000/api/debug/relations/article/hello-world?workspaceSlug=becms&depth=3
 */
router.get("/relations/:contentTypeApiKey/:slug", async (req, res, next) => {
  try {
    const { contentTypeApiKey, slug } = req.params;
    const {
      workspaceId: qWorkspaceId,
      workspaceSlug,
      depth = "1",
      summary = "basic",
    } = req.query;

    // --- 1) Resolve workspace ---
    let workspace = null;

    if (qWorkspaceId) {
      workspace = await prisma.workspace.findUnique({
        where: { id: String(qWorkspaceId) },
      });
    } else if (workspaceSlug) {
      workspace = await prisma.workspace.findUnique({
        where: { slug: String(workspaceSlug) },
      });
    } else {
      // fallback: coba pakai slug "becms" (sesuai seed)
      workspace = await prisma.workspace.findUnique({
        where: { slug: "becms" },
      });
    }

    if (!workspace) {
      return res.status(400).json({ message: "Workspace not found" });
    }

    // --- 2) Cari ContentType berdasarkan apiKey + workspace ---
    const ct = await prisma.contentType.findFirst({
      where: {
        workspaceId: workspace.id,
        apiKey: contentTypeApiKey,
      },
    });

    if (!ct) {
      return res.status(404).json({
        message: `ContentType ${contentTypeApiKey} not found in workspace`,
      });
    }

    // --- 3) Cari entry berdasarkan slug + contentType + workspace ---
    const entry = await prisma.contentEntry.findFirst({
      where: {
        workspaceId: workspace.id,
        contentTypeId: ct.id,
        slug,
        isPublished: true,
      },
    });

    if (!entry) {
      return res.status(404).json({
        message: `Entry with slug '${slug}' not found`,
      });
    }

    // --- 4) Expand relations dengan depth yang diminta ---
    const numericDepth = Number(depth) || 1;

    const relMap = await expandRelations({
      workspaceId: workspace.id,
      entries: [entry],
      contentTypeId: ct.id,
      depth: numericDepth,
      summary: summary === "full" ? "full" : "basic",
      // allowedFieldApiKeys: bisa diisi Set([...]) kalau mau filter field RELATION
    });

    const relations = relMap.get(entry.id) || {};

    // --- 5) Return debug payload ---
    return res.json({
      ok: true,
      workspace: {
        id: workspace.id,
        slug: workspace.slug,
      },
      contentType: {
        id: ct.id,
        apiKey: ct.apiKey,
        name: ct.name,
      },
      depth: numericDepth,
      entry,
      relations, // <— bagian penting buat poin 1
    });
  } catch (err) {
    next(err);
  }
});

export default router;
