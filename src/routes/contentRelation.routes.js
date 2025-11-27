// src/routes/contentRelation.routes.js
import express from "express";
import service from "../modules/content/contentRelation/contentRelation.service.js";
import { workspaceContext } from "../middlewares/workspace.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../modules/rbac/rbac.constants.js";

const router = express.Router();

/**
 * POST /content/relations/attach
 * Tambah satu relasi NON-M2M (ONE_TO_ONE / ONE_TO_MANY / MANY_TO_ONE)
 * Body:
 *  - fieldId
 *  - fromEntryId
 *  - toEntryId
 */
router.post(
  "/content/relations/attach",
  workspaceContext,
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_RELATIONS),
  async (req, res, next) => {
    try {
      const workspaceId = req.workspace?.id;
      const { fieldId, fromEntryId, toEntryId } = req.body;

      if (!workspaceId || !fieldId || !fromEntryId || !toEntryId) {
        return res.status(400).json({
          message:
            "workspaceId (via context), fieldId, fromEntryId, toEntryId required",
        });
      }

      const relation = await service.append({
        workspaceId,
        fieldId,
        fromEntryId,
        toEntryId,
      });

      res.status(201).json({ ok: true, relation });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * DELETE /content/relations/detach
 * Hapus relasi NON-M2M berdasarkan id baris ContentRelation
 * Body:
 *  - id
 */
router.delete(
  "/content/relations/detach",
  workspaceContext,
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_RELATIONS),
  async (req, res, next) => {
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ message: "id required" });
      }
      await service.delete(id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /content/relations/list
 * Query:
 *  - fieldId
 *  - fromEntryId
 *
 * Mengembalikan list relasi NON-M2M yang sudah terurut (position ASC)
 */
router.get(
  "/content/relations/list",
  workspaceContext,
  authorize(ACTIONS.READ, RESOURCES.CONTENT_RELATIONS),
  async (req, res, next) => {
    try {
      const { fieldId, fromEntryId } = req.query;
      if (!fieldId || !fromEntryId) {
        return res
          .status(400)
          .json({ message: "fieldId & fromEntryId required" });
      }

      const rows = await service.list({
        fieldId: String(fieldId),
        fromEntryId: String(fromEntryId),
      });

      res.json({ ok: true, rows });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /content/relations/from-by-related
 * POIN 4: reverse lookup NON-M2M
 * Query:
 *  - fieldId
 *  - relatedEntryId
 *  - page? (default 1)
 *  - pageSize? (default 20)
 *
 * Mengembalikan semua fromEntryId yang terkait ke relatedEntryId
 * untuk field RELATION tertentu.
 */
router.get(
  "/content/relations/from-by-related",
  workspaceContext,
  authorize(ACTIONS.READ, RESOURCES.CONTENT_RELATIONS),
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

/**
 * PATCH /content/relations/:fieldId/:fromEntryId/reorder
 * Set urutan relasi NON-M2M (ONE_TO_MANY)
 * Body:
 *  - toEntryIds: string[]   // urutan baru
 */
router.patch(
  "/content/relations/:fieldId/:fromEntryId/reorder",
  workspaceContext,
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_RELATIONS), // sesuai gaya kamu
  async (req, res, next) => {
    try {
      const { fieldId, fromEntryId } = req.params;
      const { toEntryIds } = req.body; // array urutan baru

      if (!Array.isArray(toEntryIds)) {
        return res.status(400).json({ message: "toEntryIds must be array" });
      }

      const rows = await service.reorder({
        fieldId,
        fromEntryId,
        orderedToEntryIds: toEntryIds,
      });

      res.json({ ok: true, rows });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
