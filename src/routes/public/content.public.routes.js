// src/routes/public/content.public.routes.js
import express from "express";
import prisma from "../../config/prismaClient.js";
import { workspaceContext } from "../../middlewares/workspace.js";
import contentEntryController from "../../modules/content/contentEntry.controller.js";
import { expandRelations } from "../../modules/content/relations.expander.js";

const router = express.Router();

/** =========================
 *  UTIL: resolve ContentType.id dari apiKey
 *  ========================= */
async function resolveCTIdOrThrow(workspaceId, apiKey) {
  const ct = await prisma.contentType.findFirst({
    where: { workspaceId, apiKey },
    select: { id: true },
  });
  if (!ct) {
    const err = new Error("Content type not found");
    err.status = 404;
    throw err;
  }
  return ct.id;
}

/**
 * GET /sitemap.xml
 * (path akhir tergantung mount router di index.js)
 *
 * Draft sitemap berbasis ContentEntry:
 * - hanya isPublished = true dan slug != null
 * - pola URL: /content/:contentTypeApiKey/:slug  (sesuaikan dgn FE kamu)
 */
router.get("/sitemap.xml", workspaceContext, async (req, res) => {
  try {
    const workspaceId =
      req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];
    if (!workspaceId) {
      return res.status(400).json({ message: "workspaceId required" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const entries = await prisma.contentEntry.findMany({
      where: {
        workspaceId,
        isPublished: true,
        slug: { not: null },
      },
      include: {
        contentType: {
          select: { apiKey: true },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const urlsXml = entries
      .map((entry) => {
        const loc = `${baseUrl}/content/${entry.contentType.apiKey}/${entry.slug}`;
        const lastmod = entry.updatedAt.toISOString();

        return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`;
      })
      .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;

    res.header("Content-Type", "application/xml; charset=utf-8");
    return res.send(xml);
  } catch (err) {
    console.error(err);
    res
      .status(400)
      .json({ message: err.message || "Failed to generate sitemap" });
  }
});

/**
 * GET /:contentType
 * List PUBLISHED ONLY + SEO fields
 *
 * Query:
 *  - q        : string (search seoTitle/slug/metaDescription)
 *  - page     : number (default 1)
 *  - pageSize : number (default 10, max 100)
 *  - sort     : "publishedAt:desc" default | "publishedAt:asc" | "seoTitle:asc" | ...
 *  - include  : "values" dan/atau "relations" (comma-separated)
 *  - relations: "author,brand,categories" (filter field RELATION by apiKey)
 *  - relationsDepth   : number (default 1; dibatasi 1..3 di sini)
 *  - relationsSummary : "basic" | "full" (full = target include values)
 */
router.get("/:contentType", workspaceContext, async (req, res) => {
  try {
    const workspaceId =
      req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];
    if (!workspaceId)
      return res.status(400).json({ message: "workspaceId required" });

    const { contentType } = req.params;
    const {
      q = "",
      page = 1,
      pageSize = 10,
      sort = "publishedAt:desc",
      include = "",
      relations = "",
      relationsDepth = 1,
      relationsSummary = "basic",
    } = req.query;

    const contentTypeId = await resolveCTIdOrThrow(workspaceId, contentType);

    // parse include flags
    const includeSet = new Set(
      String(include)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const wantValues = includeSet.has("values");
    const wantRelations = includeSet.has("relations");

    // whitelist RELATION field apiKey
    const relationKeys = new Set(
      String(relations)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const depth = Math.max(1, Math.min(3, Number(relationsDepth || 1)));
    const summary = relationsSummary === "full" ? "full" : "basic";

    // parsing sort
    const [sortField, sortDir] = String(sort).split(":");
    const orderBy = [
      { [sortField || "publishedAt"]: (sortDir || "desc").toLowerCase() },
    ];

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
              {
                metaDescription: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    const take = Math.max(1, Math.min(100, Number(pageSize)));
    const pageNum = Math.max(1, Number(page));
    const skip = (pageNum - 1) * take;

    // select vs include values
    const selectBase = {
      id: true,
      slug: true,
      seoTitle: true,
      metaDescription: true,
      keywords: true,
      publishedAt: true,
      createdAt: true,
    };

    const listQuery = wantValues
      ? {
          where,
          orderBy,
          skip,
          take,
          include: {
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
          },
        }
      : {
          where,
          orderBy,
          skip,
          take,
          select: selectBase,
        };

    const [items, total] = await Promise.all([
      prisma.contentEntry.findMany(listQuery),
      prisma.contentEntry.count({ where }),
    ]);

    // expand relations (optional) pakai relations.expander.js (no.5)
    if (wantRelations && items.length > 0) {
      const relMap = await expandRelations({
        workspaceId,
        entries: items,
        contentTypeId,
        depth,
        summary,
        allowedFieldApiKeys: relationKeys.size ? relationKeys : null,
      });

      for (const it of items) {
        it._relations = relMap.get(it.id) || {};
      }
    }

    res.json({
      rows: items,
      total,
      page: pageNum,
      pageSize: take,
      pages: Math.max(1, Math.ceil(total / take)),
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || "Server error" });
  }
});

/**
 * GET /:contentType/:slug
 * Detail PUBLISHED ONLY + SEO fields
 *
 * Query:
 *  - include=values[,relations]
 *  - relations=author,brand,...
 *  - relationsDepth=1..3
 *  - relationsSummary=basic|full
 */
router.get("/:contentType/:slug", workspaceContext, async (req, res) => {
  try {
    const workspaceId =
      req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];
    if (!workspaceId)
      return res.status(400).json({ message: "workspaceId required" });

    const { contentType, slug } = req.params;
    const {
      include = "",
      relations = "",
      relationsDepth = 1,
      relationsSummary = "basic",
    } = req.query;

    const contentTypeId = await resolveCTIdOrThrow(workspaceId, contentType);

    const includeSet = new Set(
      String(include)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const wantValues = includeSet.has("values");
    const wantRelations = includeSet.has("relations");

    const relationKeys = new Set(
      String(relations)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const depth = Math.max(1, Math.min(3, Number(relationsDepth || 1)));
    const summary = relationsSummary === "full" ? "full" : "basic";

    const selectBase = {
      id: true,
      slug: true,
      seoTitle: true,
      metaDescription: true,
      keywords: true,
      publishedAt: true,
      createdAt: true,
    };

    const detailQuery = wantValues
      ? {
          where: {
            workspaceId,
            contentTypeId,
            slug,
            isPublished: true,
          },
          include: {
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
          },
        }
      : {
          where: {
            workspaceId,
            contentTypeId,
            slug,
            isPublished: true,
          },
          select: selectBase,
        };

    const item = await prisma.contentEntry.findFirst(detailQuery);

    if (!item)
      return res
        .status(404)
        .json({ message: "Entry not found or not published" });

    if (wantRelations) {
      const relMap = await expandRelations({
        workspaceId,
        entries: [item],
        contentTypeId,
        depth,
        summary,
        allowedFieldApiKeys: relationKeys.size ? relationKeys : null,
      });

      item._relations = relMap.get(item.id) || {};
    }

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || "Server error" });
  }
});

/**
 * Search entries untuk relation picker (public/admin sama-sama bisa pakai endpoint ini)
 * GET /:contentType/search
 */
router.get(
  "/:contentType/search",
  workspaceContext,
  contentEntryController.searchForRelation
);

export default router;
