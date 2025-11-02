import express from "express";
import memberController from "../modules/workspace/member.controller.js";

const router = express.Router({ mergeParams: true });

// List member workspace
router.get("/", memberController.list);

// Tambah member (opsional langsung role)
router.post("/", memberController.add);

// Set/ubah role member (roleId boleh null untuk lepas role)
router.patch("/:memberId/role", memberController.setRole);

// Hapus member dari workspace
router.delete("/:memberId", memberController.remove);

export default router;
