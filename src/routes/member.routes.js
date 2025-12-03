// src/routes/member.routes.js
import express from "express";
import memberController from "../modules/workspace/member.controller.js";

const router = express.Router({ mergeParams: true });

/**
 * NOTE:
 *  Route ini SELALU dimount dari workspace.routes.js:
 *
 *    router.use(
 *      "/:workspaceId/members",
 *      auth,
 *      attachWsFromParam("workspaceId"),
 *      authorize(ACTIONS.UPDATE, RESOURCES.WORKSPACES),
 *      memberRoutes
 *    );
 *
 *  Jadi proteksi:
 *   - auth
 *   - penentuan workspace (attachWsFromParam)
 *   - RBAC authorize(ACTIONS.UPDATE, RESOURCES.WORKSPACES)
 *
 *  sudah dilakukan di level parent.
 *
 *  Jangan mount router ini langsung di app tanpa guard di atas.
 */

// List member workspace
router.get("/", memberController.list);

// Tambah member (opsional langsung role)
router.post("/", memberController.add);

// Set/ubah role member (roleId boleh null untuk lepas role)
router.patch("/:memberId/role", memberController.setRole);

// Hapus member dari workspace
router.delete("/:memberId", memberController.remove);

export default router;
