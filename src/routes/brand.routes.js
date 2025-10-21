import express from "express";
import brandController from "../modules/brand/brand.controller.js";

const router = express.Router();

router.get("/", brandController.getAll);
router.get("/:id", brandController.getById);
router.post("/", brandController.create);
router.put("/:id", brandController.update);
router.delete("/:id", brandController.delete);

export default router;
