import express from "express";
import { auth } from "../../middlewares/auth.js";
import { workspaceGuard as workspaceContext } from "../../middlewares/workspaceContext.js";
// import { authorize } from "../../middlewares/authorize.js"; // aktifkan jika modul permission sudah siap
import prisma from "../../config/prismaClient.js";
import { recomputeDenormForRelationField } from "../../services/denorm.service.js";

const router = express.Router();

// Proteksi dasar
router.use(auth, workspaceContext);
// router.use(authorize("UPDATE", "CONTENT_RELATIONS"));

/**
 * POST /api/admin/content/m2m/:fieldId/attach
 * Body: { fromEntryId: string, toEntryIds: string[] }
 * Efek: menambah relasi M2M dan langsung trigger denormalisasi pada fromEntryId tsb
 */
router.post("/:fieldId/attach", async (req, res) => {
  try {
    const workspaceId = req.workspace?.id || req.headers["x-workspace-id"];
    const { fieldId } = req.params;
    const { fromEntryId, toEntryIds = [] } = req.body;

    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });
    if (!fromEntryId || !Array.isArray(toEntryIds))
      return res.status(400).json({ error: "fromEntryId and toEntryIds[] are required" });

    // Tulis M2M; gunakan createMany skipDuplicates agar idempotent
    const data = toEntryIds.map((toId) => ({
      workspaceId,
      relationFieldId: String(fieldId),
      fromEntryId: String(fromEntryId),
      toEntryId: String(toId),
    }));

    // Prisma createMany + skipDuplicates bekerja jika ada unique index pada triple
    await prisma.contentRelationM2M.createMany({
      data,
      skipDuplicates: true,
    });

    // 🔁 Trigger denormalisasi untuk entry sumber ini pada field relasi tersebut
    await recomputeDenormForRelationField({
      workspaceId: String(workspaceId),
      relationFieldId: String(fieldId),
      fromEntryIds: [String(fromEntryId)],
    });

    res.json({ ok: true, attached: toEntryIds.length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /api/admin/content/m2m/:fieldId/detach
 * Body: { fromEntryId: string, toEntryIds: string[] }
 * Efek: menghapus relasi M2M dan langsung trigger denormalisasi pada fromEntryId tsb
 */
router.post("/:fieldId/detach", async (req, res) => {
  try {
    const workspaceId = req.workspace?.id || req.headers["x-workspace-id"];
    const { fieldId } = req.params;
    const { fromEntryId, toEntryIds = [] } = req.body;

    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });
    if (!fromEntryId || !Array.isArray(toEntryIds))
      return res.status(400).json({ error: "fromEntryId and toEntryIds[] are required" });

    await prisma.contentRelationM2M.deleteMany({
      where: {
        workspaceId: String(workspaceId),
        relationFieldId: String(fieldId),
        fromEntryId: String(fromEntryId),
        toEntryId: { in: toEntryIds.map(String) },
      },
    });

    // 🔁 Trigger denormalisasi setelah detach
    await recomputeDenormForRelationField({
      workspaceId: String(workspaceId),
      relationFieldId: String(fieldId),
      fromEntryIds: [String(fromEntryId)],
    });

    res.json({ ok: true, detached: toEntryIds.length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * GET /api/admin/content/m2m/:fieldId/:fromEntryId
 * Kembalikan daftar toEntryIds yang terhubung (ringkas untuk UI)
 */
router.get("/:fieldId/:fromEntryId", async (req, res) => {
  try {
    const workspaceId = req.workspace?.id || req.headers["x-workspace-id"];
    const { fieldId, fromEntryId } = req.params;

    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const rows = await prisma.contentRelationM2M.findMany({
      where: {
        workspaceId: String(workspaceId),
        relationFieldId: String(fieldId),
        fromEntryId: String(fromEntryId),
      },
      select: { toEntryId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      fieldId: String(fieldId),
      fromEntryId: String(fromEntryId),
      toEntryIds: rows.map((r) => r.toEntryId),
      total: rows.length,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
