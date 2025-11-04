import express from "express";

// Core/auth
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import workspaceRoutes from "./workspace.routes.js";
import roleRoutes from "./role.routes.js";
import permissionRoutes from "./permission.routes.js";

// Business modules
import planRoutes from "./plan.routes.js";
import brandRoutes from "./brand.routes.js";
import productRoutes from "./product.routes.js";
import contentRoutes from "./content.routes.js";
import contentFieldRoutes from "./contentField.routes.js";

// Admin (protected per-file)
import contentAdminRoutes from "./admin/content.admin.routes.js";
import brandAdminRoutes from "./admin/brand.admin.routes.js";
import productAdminRoutes from "./admin/product.admin.routes.js";
import planAdminRoutes from "./admin/plan.admin.routes.js";
import m2mAdminRoutes from "./admin/content.m2m.admin.routes.js";
import denormAdmin from "./admin/content.denorm.routes.js";
// Public (no auth)
import contentPublicRoutes from "./public/content.public.routes.js";
import docsRoutes from "./docs.routes.js"; 
import uploadRoutes from "./upload.routes.js";

const router = express.Router();

// --- Auth dulu ---
router.use("/auth", authRoutes);

// --- Core ---
router.use("/users", userRoutes);
router.use("/workspaces", workspaceRoutes);
router.use("/roles", roleRoutes);
router.use("/permissions", permissionRoutes);

// --- Business modules ---
router.use("/plans", planRoutes);
router.use("/brands", brandRoutes);
router.use("/products", productRoutes);
router.use("/content", contentRoutes);
router.use("/content/types/:contentTypeId/fields", contentFieldRoutes);

// --- Admin (prefix /admin/...) ---
router.use("/admin/content", contentAdminRoutes);
router.use("/admin/brands", brandAdminRoutes);
router.use("/admin/products", productAdminRoutes);
router.use("/admin/plans", planAdminRoutes);
router.use("/admin/content/m2m", m2mAdminRoutes);
router.use("/admin/content/denorm", denormAdmin);
// --- Public (no auth) ---
router.use("/public/content", contentPublicRoutes);
router.use("/docs", docsRoutes);
router.use("/uploads", uploadRoutes);
router.use("/content", contentPublicRoutes);
export default router;
