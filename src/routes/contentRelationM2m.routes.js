// src/routes/contentRelationM2m.routes.js
import express from "express";
import service from "../modules/content/contentRelationM2m.service.js";
import { workspaceContext } from "../middlewares/workspace.js";
import { authorize } from "../middlewares/authorize.js";

const router = express.Router();

/**
 * POST /content/relations/m2m/attach
 * Tambah relasi M2M (banyak target sekaligus)
 * Body:
 *  - fieldId
 *  - fromEntryId
 *  - toEntryIds: string[]
 */
router.post(
  "/content/relations/m2m/attach",
  workspaceContext,
  authorize("CONTENT", "UPDATE"),
  async (req, res, next) => {
    try {
      const workspaceId = req.workspace?.id;
      const { fieldId, fromEntryId, toEntryIds = [] } = req.body;

      if (!workspaceId || !fieldId || !fromEntryId) {
        return res.status(400).json({
          message: "workspaceId (via context), fieldId, fromEntryId required",
        });
      }
      if (!Array.isArray(toEntryIds) || toEntryIds.length === 0) {
        return res
          .status(400)
          .json({ message: "toEntryIds must be non-empty array" });
      }

      const rows = await service.attach({
        workspaceId,
        fieldId,
        fromEntryId,
        toEntryIds,
      });

      res.status(201).json({ ok: true, rows });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * DELETE /content/relations/m2m/detach
 * Hapus relasi M2M
 * Body:
 *  - fieldId
 *  - fromEntryId
 *  - toEntryIds: string[]
 */
router.delete(
  "/content/relations/m2m/detach",
  workspaceContext,
  authorize("CONTENT", "UPDATE"),
  async (req, res, next) => {
    try {
      const workspaceId = req.workspace?.id;
      const { fieldId, fromEntryId, toEntryIds = [] } = req.body;

      if (!workspaceId || !fieldId || !fromEntryId) {
        return res.status(400).json({
          message: "workspaceId (via context), fieldId, fromEntryId required",
        });
      }
      if (!Array.isArray(toEntryIds) || toEntryIds.length === 0) {
        return res
          .status(400)
          .json({ message: "toEntryIds must be non-empty array" });
      }

      const out = await service.detach({
        workspaceId,
        fieldId,
        fromEntryId,
        toEntryIds,
      });

      res.json({ ok: true, ...out });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * PATCH /content/relations/m2m/:fieldId/:fromEntryId/reorder
 * Set urutan baru M2M (position)
 * Body:
 *  - toEntryIds: string[]
 */
router.patch(
  "/content/relations/m2m/:fieldId/:fromEntryId/reorder",
  workspaceContext,
  authorize("CONTENT", "UPDATE"),
  async (req, res, next) => {
    try {
      const { fieldId, fromEntryId } = req.params;
      const { toEntryIds } = req.body;
      const workspaceId = req.workspace?.id;

      if (!Array.isArray(toEntryIds)) {
        return res.status(400).json({ message: "toEntryIds must be array" });
      }

      const out = await service.reorder({
        workspaceId,
        fieldId,
        fromEntryId,
        orderedToEntryIds: toEntryIds,
      });

      res.json({ ok: true, ...out });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /content/relations/m2m/list
 * Query:
 *  - fieldId
 *  - fromEntryId
 *  - page? (default 1)
 *  - pageSize? (default 20)
 */
router.get(
  "/content/relations/m2m/list",
  workspaceContext,
  authorize("CONTENT", "READ"),
  async (req, res, next) => {
    try {
      const workspaceId = req.workspace?.id;
      const { fieldId, fromEntryId, page = 1, pageSize = 20 } = req.query;

      if (!workspaceId || !fieldId || !fromEntryId) {
        return res.status(400).json({
          message: "workspaceId (via context), fieldId, fromEntryId required",
        });
      }

      const out = await service.list({
        workspaceId,
        fieldId: String(fieldId),
        fromEntryId: String(fromEntryId),
        page: Number(page),
        pageSize: Number(pageSize),
      });

      res.json({ ok: true, ...out });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /content/relations/m2m/from-by-related
 * Reverse lookup M2M:
 *  - fieldId         : RELATION field (MANY_TO_MANY)
 *  - relatedEntryId  : entry yang menjadi "target"
 *  - page?           : default 1
 *  - pageSize?       : default 20
 *
 * Mengembalikan semua fromEntryId yang terkait ke relatedEntryId
 * untuk relasi MANY_TO_MANY tertentu.
 */
router.get(
  "/content/relations/m2m/from-by-related",
  workspaceContext,
  authorize("CONTENT", "READ"),
  async (req, res, next) => {
    try {
      const workspaceId = req.workspace?.id;
      const { fieldId, relatedEntryId, page = 1, pageSize = 20 } = req.query;

      if (!workspaceId || !fieldId || !relatedEntryId) {
        return res.status(400).json({
          message:
            "workspaceId (via context), fieldId, relatedEntryId required",
        });
      }

      const out = await service.filterFromByRelated({
        workspaceId,
        fieldId: String(fieldId),
        relatedEntryId: String(relatedEntryId),
        page: Number(page),
        pageSize: Number(pageSize),
      });

      res.json({ ok: true, ...out });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
