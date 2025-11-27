// src/routes/index.js
import express from "express";

// Core / Auth
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
import subscriptionRoutes from "./subscription.routes.js";

// Admin (protected per-file)
import contentAdminRoutes from "./admin/content.admin.routes.js";
import brandAdminRoutes from "./admin/brand.admin.routes.js";
import productAdminRoutes from "./admin/product.admin.routes.js";
import planAdminRoutes from "./admin/plan.admin.routes.js";
import m2mAdminRoutes from "./admin/content.m2m.admin.routes.js";
import denormAdminRoutes from "./admin/content.denorm.routes.js";
import billingAdminRoutes from "./admin/billing.routes.js";

// Relations (NON-M2M & M2M)
import contentRelationRoutes from "./contentRelation.routes.js";
import contentRelationM2mRoutes from "./contentRelationM2m.routes.js";

// Public (NO auth)
import contentPublicRoutes from "./public/content.public.routes.js";
import docsRoutes from "./docs.routes.js";
import uploadRoutes from "./upload.routes.js";

// Webhooks
import billingWebhookRoutes from "./billing.webhook.routes.js";

// Debug (opsional)
import debugRelationsRoutes from "./debug.relations.routes.js";
import debugContentTypesRoutes from "./debug.contentTypes.routes.js";

const router = express.Router();

// --- Debug routes (sebaiknya dibatasi di non-production) ---
router.use("/debug", debugRelationsRoutes);
router.use("/debug", debugContentTypesRoutes);

// --- Auth (login/register/reset) ---
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
router.use("/admin/subscription", subscriptionRoutes);

// --- Relations (path jelas di sini, child router pakai path relatif) ---
router.use("/content/relations", contentRelationRoutes);
router.use("/content/relations/m2m", contentRelationM2mRoutes);

// --- Admin (protected) ---
router.use("/admin/content/m2m", m2mAdminRoutes);
router.use("/admin/content/denorm", denormAdminRoutes);
router.use("/admin/content", contentAdminRoutes);
router.use("/admin/billing", billingAdminRoutes);

router.use("/admin/brands", brandAdminRoutes);
router.use("/admin/products", productAdminRoutes);
router.use("/admin/plans", planAdminRoutes);

// --- Public (NO auth) ---
router.use("/public/content", contentPublicRoutes);
router.use("/docs", docsRoutes);
router.use("/uploads", uploadRoutes);

// --- Webhooks ---
router.use("/webhooks/billing", billingWebhookRoutes);

export default router;
