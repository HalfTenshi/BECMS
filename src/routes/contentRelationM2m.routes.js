// src/routes/contentRelationM2m.routes.js
import express from "express";

import service from "../modules/content/contentRelationM2m.service.js";
import { auth } from "../middlewares/auth.js";
import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";

const router = express.Router();

/**
 * Admin Content Relation M2M
 *
 * Semua endpoint di file ini:
 *  - Mengelola relasi MANY_TO_MANY (M2M) via tabel ContentRelationM2M
 *  - Hanya bisa diakses jika:
 *      - auth OK
 *      - workspaceContext sudah resolve workspace
 *      - authorize(ACTIONS.X, RESOURCES.CONTENT_RELATIONS) berhasil
 *
 * Catatan arsitektur:
 *  - Public API (GET /api/public/content/...) membaca data M2M
 *    melalui relations.expander.js yang melakukan bulk fetch dan
 *    menghormati kolom position.
 *  - Route admin di sini fokus ke mutasi data (attach, detach, reorder).
 */

// 🔒 Proteksi dasar: semua endpoint di sini butuh auth + workspace
router.use(auth, workspaceContext);

/**
 * POST /content/relations/m2m/attach
 * Tambah relasi M2M (banyak target sekaligus).
 *
 * Body:
 *  - fieldId      : RELATION field M2M
 *  - fromEntryId  : entry sumber
 *  - toEntryIds   : string[] (daftar entry target)
 *
 * Behaviour:
 *  - Implementasi biasanya menggunakan createMany + skipDuplicates,
 *    sehingga pemanggilan ulang menjadi idempotent.
 */
router.post(
  "/content/relations/m2m/attach",
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_RELATIONS),
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
 * Hapus relasi M2M untuk kombinasi (fieldId, fromEntryId, toEntryIds[]).
 *
 * Body:
 *  - fieldId      : RELATION field M2M
 *  - fromEntryId  : entry sumber
 *  - toEntryIds   : string[]
 *
 * Behaviour:
 *  - Menghapus baris pada tabel ContentRelationM2M.
 *  - Public API akan otomatis merefleksikan perubahan ini,
 *    karena relations.expander.js membaca langsung dari tabel tersebut.
 */
router.delete(
  "/content/relations/m2m/detach",
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_RELATIONS),
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
 * Set urutan baru M2M (position) berdasarkan toEntryIds[].
 *
 * Params:
 *  - fieldId      : RELATION field M2M
 *  - fromEntryId  : entry sumber
 *
 * Body:
 *  - toEntryIds: string[] (urutan baru target IDs)
 *
 * Behaviour:
 *  - position di ContentRelationM2M akan di-update mengikuti urutan array ini.
 *  - Public API yang membaca M2M akan menampilkan relasi dengan urutan sama,
 *    karena expander mengurutkan berdasarkan kolom position.
 */
router.patch(
  "/content/relations/m2m/:fieldId/:fromEntryId/reorder",
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_RELATIONS),
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
 *
 * Query:
 *  - fieldId      : RELATION field M2M
 *  - fromEntryId  : entry sumber
 *  - page?        : default 1
 *  - pageSize?    : default 20
 *
 * Mengembalikan daftar target (toEntryId) yang terhubung ke satu sumber
 * pada field RELATION M2M tertentu.
 *
 * Cocok untuk:
 *  - UI admin yang butuh pagination atas relasi M2M.
 */
router.get(
  "/content/relations/m2m/list",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_RELATIONS),
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
 *
 * Query:
 *  - fieldId         : RELATION field (MANY_TO_MANY)
 *  - relatedEntryId  : entry yang menjadi target
 *  - page?           : default 1
 *  - pageSize?       : default 20
 *
 * Mengembalikan semua fromEntryId yang terkait ke relatedEntryId
 * untuk relasi MANY_TO_MANY tertentu.
 *
 * Contoh use case:
 *  - “Semua artikel yang memiliki tag X”
 *  - “Semua produk yang berada di kategori M2M Y”
 */
router.get(
  "/content/relations/m2m/from-by-related",
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

export default router;
