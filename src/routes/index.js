// src/routes/index.js
import express from "express";

// Core/auth
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import workspaceRoutes from "./workspace.routes.js";
import roleRoutes from "./role.routes.js";
import permissionRoutes from "./permission.routes.js";

// Business modules (protected)
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

// 🔹 RELATION routers (NON-M2M & M2M)
import contentRelationRoutes from "./contentRelation.routes.js";
import contentRelationM2mRoutes from "./contentRelationM2m.routes.js";

// Public (NO auth)
import contentPublicRoutes from "./public/content.public.routes.js";
import docsRoutes from "./docs.routes.js";
import uploadRoutes from "./upload.routes.js";

// (opsional) debug
import debugRelationsRoutes from "./debug.relations.routes.js";
import debugContentTypesRoutes from "./debug.contentTypes.routes.js";

const router = express.Router();

// --- Debug routes ---
router.use("/debug", debugRelationsRoutes);
router.use("/debug", debugContentTypesRoutes);

// --- Auth dulu (login/register/reset) ---
router.use("/auth", authRoutes);

// --- Core (protected via middleware di masing-masing file) ---
router.use("/users", userRoutes);
router.use("/workspaces", workspaceRoutes);
router.use("/roles", roleRoutes);
router.use("/permissions", permissionRoutes);

// --- Business modules (protected) ---
router.use("/plans", planRoutes);
router.use("/brands", brandRoutes);
router.use("/products", productRoutes);
router.use("/content", contentRoutes);
router.use("/content/types/:contentTypeId/fields", contentFieldRoutes);

// 🔹 RELATIONS (tidak pakai /admin prefix, karena path di file sudah lengkap)
// Pastikan di dalam file route-nya path sudah benar (misal `/admin/content/relations/...` atau `/content/relations/...`)
router.use(contentRelationRoutes);      // contoh: /content/relations/...
router.use(contentRelationM2mRoutes);   // contoh: /content/relations/m2m/...

// --- Admin (protected) ---
// yang lebih spesifik dulu di bawah /admin/content-* baru yang generic /admin/content
router.use("/admin/content/m2m", m2mAdminRoutes);
router.use("/admin/content/denorm", denormAdmin);
router.use("/admin/content", contentAdminRoutes);

router.use("/admin/brands", brandAdminRoutes);
router.use("/admin/products", productAdminRoutes);
router.use("/admin/plans", planAdminRoutes);

// --- Public (NO auth) ---
router.use("/public/content", contentPublicRoutes);
router.use("/docs", docsRoutes);
router.use("/uploads", uploadRoutes);

export default router;
