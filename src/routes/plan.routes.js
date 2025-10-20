import express from "express";
import planController from "../modules/plan/plan.controller.js";

const router = express.Router();

router.get("/", planController.getAll);
router.get("/:id", planController.getById);
router.post("/", planController.create);
router.put("/:id", planController.update);
router.delete("/:id", planController.delete);

export default router;
