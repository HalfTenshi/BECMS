import express from "express";
import permissionController from "../modules/role/permission.controller.js";

const router = express.Router();

router.get("/", permissionController.getAll);
router.get("/:id", permissionController.getById);
router.post("/", permissionController.create);
router.put("/:id", permissionController.update);
router.delete("/:id", permissionController.delete);

export default router;
