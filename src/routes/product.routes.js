import express from "express";
import productController from "../modules/product/product.controller.js";

const router = express.Router();

router.get("/", productController.getAll);
router.get("/:id", productController.getById);
router.post("/", productController.create);
router.put("/:id", productController.update);
router.delete("/:id", productController.delete);

export default router;
