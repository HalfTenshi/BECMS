import express from "express";
import roleController from "../modules/role/role.controller.js";

const router = express.Router();

router.get("/", roleController.getAll);
router.get("/:id", roleController.getById);
router.post("/", roleController.create);
router.put("/:id", roleController.update);
router.delete("/:id", roleController.delete);

// role <-> permissions
router.post("/:id/permissions", roleController.addPermissions);       // add
router.delete("/:id/permissions", roleController.removePermissions);  // remove

export default router;
