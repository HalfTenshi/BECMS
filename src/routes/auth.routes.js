import express from "express";
import authController from "../modules/auth/auth.controller.js";
import { auth } from "../middlewares/auth.js";

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", auth, authController.me);

router.post("/request-reset", authController.requestReset);
router.post("/reset-password", authController.resetPassword);

// (opsional) logout stateless cukup di FE hapus token

export default router;
