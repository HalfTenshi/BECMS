// src/routes/contentRelation.routes.js
import express from "express";
import service from "../modules/content/contentRelation/contentRelation.service.js";
import { workspaceContext } from "../middlewares/workspace.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../modules/rbac/rbac.constants.js";

const router = express.Router();

/**
 * Admin Content Relation (NON-M2M)
 *
 * Route-route di file ini:
 *  - Mengelola relasi NON-M2M (ONE_TO_ONE, ONE_TO_MANY, MANY_TO_ONE)
 *  - Bekerja di atas tabel ContentRelation (bukan M2M table)
 *  - Dipakai oleh panel admin / internal tools untuk mutasi relasi
 *
 * Catatan arsitektur:
 *  - Public API (GET /api/public/content/...) tidak langsung pakai route ini,
 *    tapi membaca data relasi via relations.expander.js
 *    → Admin mutasi di sini, Public endpoint cukup konsumsi hasilnya.
 */

/**
 * POST /content/relations/attach
 * Tambah satu relasi NON-M2M (ONE_TO_ONE / ONE_TO_MANY / MANY_TO_ONE)
 *
 * Body:
 *  - fieldId      : ID field RELATION pada ContentField
 *  - fromEntryId  : entry sumber
 *  - toEntryId    : entry target
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
 * Hapus relasi NON-M2M berdasarkan id baris ContentRelation.
 *
 * Body:
 *  - id : string (primary key ContentRelation)
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
 *
 * Query:
 *  - fieldId     : RELATION field
 *  - fromEntryId : entry sumber
 *
 * Mengembalikan list relasi NON-M2M untuk kombinasi (fieldId, fromEntryId),
 * sudah terurut berdasarkan position ASC.
 *
 * Dipakai biasanya untuk:
 *  - menampilkan daftar target di UI admin (mis. urutan authors, related posts)
 *  - memvalidasi/cek hasil setelah attach/detach/reorder
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
 * Reverse lookup NON-M2M (POIN 4 requirement)
 *
 * Query:
 *  - fieldId        : RELATION field
 *  - relatedEntryId : entry yang menjadi target
 *  - page?          : default 1
 *  - pageSize?      : default 20
 *
 * Mengembalikan semua fromEntryId yang terkait ke relatedEntryId
 * untuk field RELATION tertentu (reverse relation).
 *
 * Contoh use case:
 *  - “Tampilkan semua artikel yang menarget brand X”
 *  - “Semua produk yang menunjuk ke category Y”
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
 * Set urutan relasi NON-M2M (ONE_TO_MANY) berdasarkan posisi baru.
 *
 * Params:
 *  - fieldId     : RELATION field
 *  - fromEntryId : entry sumber
 *
 * Body:
 *  - toEntryIds: string[]   // urutan baru target IDs
 *
 * Catatan:
 *  - position di ContentRelation akan di-update mengikuti urutan array ini.
 *  - Public API yang membaca relasi akan mendapat urutan yang sama,
 *    karena relations.expander.js menghormati kolom position.
 */
router.patch(
  "/content/relations/:fieldId/:fromEntryId/reorder",
  workspaceContext,
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_RELATIONS),
  async (req, res, next) => {
    try {
      const { fieldId, fromEntryId } = req.params;
      const { toEntryIds } = req.body;

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
