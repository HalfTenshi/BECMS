import express from "express";
import userController from "../modules/user/user.controller.js";

const router = express.Router();

// List users (search, status, page, limit)
router.get("/", userController.getAll);

// Get user by id
router.get("/:id", userController.getById);

// Create user
router.post("/", userController.create);

// Update profile fields
router.put("/:id", userController.update);

// Update status only
router.patch("/:id/status", userController.updateStatus);

// Delete user
router.delete("/:id", userController.delete);

export default router;
