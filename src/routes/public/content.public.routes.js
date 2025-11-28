// src/routes/public/content.public.routes.js
import express from "express";
import prisma from "../../config/prismaClient.js";
import { workspaceContext } from "../../middlewares/workspace.js";
import contentEntryController from "../../modules/content/contentEntry.controller.js";
import { expandRelations } from "../../modules/content/relations.expander.js";
import { getSeoLengthHints } from "../../utils/seoUtils.js";

const router = express.Router();

/** =========================
 *  UTIL: resolve ContentType (id + seoEnabled) dari apiKey
 *  ========================= */
async function resolveContentTypeOrThrow(workspaceId, apiKey) {
  const ct = await prisma.contentType.findFirst({
    where: { workspaceId, apiKey },
    select: { id: true, apiKey: true, name: true, seoEnabled: true },
  });
  if (!ct) {
    const err = new Error("Content type not found");
    err.status = 404;
    throw err;
  }
  return ct;
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
 * GET /:contentType/search
 *
 * Search entries untuk relation picker (public/admin sama-sama bisa pakai endpoint ini)
 *
 * NOTE:
 * - Route ini didefinisikan SEBELUM pattern generic :contentType dan :slug,
 *   supaya /:contentType/search tidak ketangkep sebagai slug = "search".
 */
router.get(
  "/:contentType/search",
  workspaceContext,
  contentEntryController.searchForRelation
);

/**
 * GET /:contentType/seo-config
 *
 * Endpoint kecil untuk FE:
 * - Ambil status seoEnabled per ContentType
 * - Return length hints (SERP best practice)
 *
 * Contoh response:
 * {
 *   contentType: { id, apiKey, name, seoEnabled },
 *   seo: {
 *     enabled: true,
 *     lengthHints: { title: { recommendedMax: 60 }, metaDescription: { recommendedMax: 160 } },
 *     fields: { ... }
 *   }
 * }
 */
router.get("/:contentType/seo-config", workspaceContext, async (req, res) => {
  try {
    const workspaceId =
      req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];
    if (!workspaceId) {
      return res.status(400).json({ message: "workspaceId required" });
    }

    const { contentType } = req.params;
    const ct = await resolveContentTypeOrThrow(workspaceId, contentType);

    const hints = getSeoLengthHints();

    return res.json({
      contentType: {
        id: ct.id,
        apiKey: ct.apiKey,
        name: ct.name,
        seoEnabled: ct.seoEnabled,
      },
      seo: {
        enabled: ct.seoEnabled,
        lengthHints: hints,
        fields: {
          seoTitle: {
            type: "string",
            recommendedMax: hints.title?.recommendedMax ?? 60,
          },
          metaDescription: {
            type: "string",
            recommendedMax: hints.metaDescription?.recommendedMax ?? 160,
          },
          keywords: {
            type: "array",
            inputFormat: "string_or_array",
            separator: ",",
            description:
              "FE boleh kirim 'a,b,c' atau ['a','b','c'], BE akan normalisasi ke array.",
          },
        },
      },
    });
  } catch (err) {
    console.error(err);
    const status = err.status || 400;
    return res.status(status).json({ message: err.message || "Server error" });
  }
});

/**
 * GET /:contentType
 * List PUBLISHED ONLY + SEO fields
 *
 * Query:
 *  - q              : string (search seoTitle/slug/metaDescription)
 *  - page           : number (default 1)
 *  - pageSize       : number (default 10, max 100)
 *  - sort           : "publishedAt:desc" (default) | "publishedAt:asc" | "seoTitle:asc" | ...
 *
 *  - include        : "values" dan/atau "relations" (comma-separated)
 *      * include=values           -> sertakan fieldValue (payload konten)
 *      * include=relations        -> aktifkan ekspansi relasi
 *      * include=values,relations -> keduanya
 *
 *  - relations      : "author,brand,categories"
 *      * daftar apiKey untuk field RELATION yang boleh diekspansi.
 *      * jika kosong -> semua RELATION field pada model boleh diekspansi.
 *
 *  - relationsDepth : number (default 1; dibatasi 1..5)
 *      * nilai <1 akan di-clamp ke 1
 *      * nilai >5 akan di-clamp ke 5
 *      * tidak melempar 400; hanya di-normalisasi.
 *
 *  - relationsSummary : "basic" | "full"
 *      * basic -> target relasi dikembalikan ringkas (mis. id, slug, seoTitle, isPublished)
 *      * full  -> boleh include field tambahan (mis. contentTypeId, publishedAt)
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

    const ct = await resolveContentTypeOrThrow(workspaceId, contentType);
    const contentTypeId = ct.id;

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

    // Clamp depth 1..5 (tidak melempar error; hanya normalisasi)
    const depthRaw = Number(relationsDepth || 1);
    const depth = Number.isFinite(depthRaw)
      ? Math.max(1, Math.min(5, depthRaw))
      : 1;

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

    // Extra safety: jika SEO dimatikan untuk ContentType ini,
    // pastikan response public tidak mengandung SEO fields.
    if (ct.seoEnabled === false && items.length > 0) {
      for (const it of items) {
        it.seoTitle = null;
        it.metaDescription = null;
        it.keywords = [];
      }
    }

    // expand relations (optional) pakai relations.expander.js
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
 *  - include           : "values" dan/atau "relations"
 *  - relations         : daftar apiKey RELATION yang boleh diekspansi
 *  - relationsDepth    : 1..5 (clamp, default 1)
 *  - relationsSummary  : "basic" | "full"
 *
 * Behaviour relations:
 *  - include=relations -> aktifkan ekspansi
 *  - relationsDepth di-normalisasi ke rentang 1..5 (tanpa error 400)
 *  - relationsSummary menentukan bentuk payload target relasi
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

    const ct = await resolveContentTypeOrThrow(workspaceId, contentType);
    const contentTypeId = ct.id;

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

    const depthRaw = Number(relationsDepth || 1);
    const depth = Number.isFinite(depthRaw)
      ? Math.max(1, Math.min(5, depthRaw))
      : 1;

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

    // Extra safety jika SEO dimatikan pada model ini
    if (ct.seoEnabled === false) {
      item.seoTitle = null;
      item.metaDescription = null;
      item.keywords = [];
    }

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

export default router;
