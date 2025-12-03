// src/routes/admin/content.denorm.routes.js
import express from "express";
import { auth } from "../../middlewares/auth.js";
import workspaceContext from "../../middlewares/workspaceContext.js";
import { authorize } from "../../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../../constants/permissions.js";
import {
  recomputeDenormForRelationField,
  recomputeDenormForTargetChange,
} from "../../services/denorm.service.js";

const router = express.Router();

// 🔒 Semua denorm admin butuh UPDATE CONTENT_ENTRIES
router.use(
  auth,
  workspaceContext,
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_ENTRIES)
);

// Trigger recompute berdasarkan relation field + daftar fromEntry
router.post("/recompute/field", async (req, res) => {
  try {
    const workspaceId = req.workspace?.id || req.headers["x-workspace-id"];
    const { relationFieldId, fromEntryIds = [] } = req.body;

    await recomputeDenormForRelationField({
      workspaceId,
      relationFieldId,
      fromEntryIds,
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Trigger recompute berdasarkan target yang berubah
router.post("/recompute/target", async (req, res) => {
  try {
    const workspaceId = req.workspace?.id || req.headers["x-workspace-id"];
    const { targetEntryId } = req.body;

    await recomputeDenormForTargetChange({
      workspaceId,
      targetEntryId,
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
