import express from "express";
import prisma from "../../config/prismaClient.js";
import { workspaceContext } from "../../middlewares/workspace.js";
import contentEntryController from "../../modules/content/contentEntry.controller.js";

const router = express.Router();

/** Util: resolve ContentType.id dari apiKey (contentType param) di workspace */
async function resolveCTIdOrThrow(workspaceId, apiKey) {
  const ct = await prisma.contentType.findFirst({
    where: { workspaceId, apiKey },
    select: { id: true },
  });
  if (!ct) throw new Error("Content type not found");
  return ct.id;
}

/**
 * GET /api/content/:contentType
 * List PUBLISHED ONLY + SEO fields
 * Query opsional:
 *  - q        : string (search di seoTitle/slug)
 *  - page     : number (default 1)
 *  - pageSize : number (default 10)
 *  - sort     : "publishedAt:desc" (default) | "publishedAt:asc" | "seoTitle:asc" | ...
 *  - include  : "values" => sertakan values (dinamis)
 */
router.get("/:contentType", workspaceContext, async (req, res) => {
  try {
    const workspaceId = req.ctx?.workspaceId || req.headers["x-workspace-id"];
    if (!workspaceId) return res.status(400).json({ message: "workspaceId required" });

    const { contentType } = req.params;
    const {
      q = "",
      page = 1,
      pageSize = 10,
      sort = "publishedAt:desc",
      include = "",
    } = req.query;

    const contentTypeId = await resolveCTIdOrThrow(workspaceId, contentType);

    // parsing sort
    const [sortField, sortDir] = String(sort).split(":");
    const orderBy = [{ [sortField || "publishedAt"]: (sortDir || "desc").toLowerCase() }];

    // filter published-only + optional search
    const where = {
      workspaceId,
      contentTypeId,
      isPublished: true,
      ...(q
        ? {
            OR: [
              { seoTitle: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const skip = (Number(page) - 1) * Number(pageSize);

    const selectBase = {
      id: true,
      slug: true,
      seoTitle: true,
      metaDescription: true,
      keywords: true,
      publishedAt: true,
      createdAt: true,
    };
    const select =
      include === "values"
        ? {
            ...selectBase,
            values: {
              select: {
                fieldId: true,
                valueString: true,
                valueNumber: true,
                valueBoolean: true,
                valueDate: true,
                valueJson: true,
              },
            },
          }
        : selectBase;

    const [rows, total] = await prisma.$transaction([
      prisma.contentEntry.findMany({
        where,
        orderBy,
        skip,
        take: Number(pageSize),
        select,
      }),
      prisma.contentEntry.count({ where }),
    ]);

    res.json({
      rows,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (err) {
    res.status(400).json({ message: err.message || "Server error" });
  }
});

/**
 * GET /api/content/:contentType/:slug
 * Detail PUBLISHED ONLY + SEO fields
 * Query opsional:
 *  - include=values  => sertakan values (dinamis)
 */
router.get("/:contentType/:slug", workspaceContext, async (req, res) => {
  try {
    const workspaceId = req.ctx?.workspaceId || req.headers["x-workspace-id"];
    if (!workspaceId) return res.status(400).json({ message: "workspaceId required" });

    const { contentType, slug } = req.params;
    const { include = "" } = req.query;

    const contentTypeId = await resolveCTIdOrThrow(workspaceId, contentType);

    const selectBase = {
      id: true,
      slug: true,
      seoTitle: true,
      metaDescription: true,
      keywords: true,
      publishedAt: true,
      createdAt: true,
    };
    const select =
      include === "values"
        ? {
            ...selectBase,
            values: {
              select: {
                fieldId: true,
                valueString: true,
                valueNumber: true,
                valueBoolean: true,
                valueDate: true,
                valueJson: true,
              },
            },
          }
        : selectBase;

    const item = await prisma.contentEntry.findFirst({
      where: { workspaceId, contentTypeId, slug, isPublished: true },
      select,
    });

    if (!item) return res.status(404).json({ message: "Entry not found or not published" });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: err.message || "Server error" });
  }
});

/**
 * Search entries untuk relation picker (public/admin sama2 bisa pakai endpoint ini)
 * GET /api/content/:contentType/search
 */
router.get("/:contentType/search", workspaceContext, contentEntryController.searchForRelation);

export default router;
