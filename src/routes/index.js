import express from "express";
// import userRoutes from "./user.routes.js";
import workspaceRoutes from "./workspace.routes.js";
import contentRoutes from "./content.routes.js";
// import roleRoutes from "./role.routes.js";
import planRoutes from "./plan.routes.js";
import brandRoutes from "./brand.routes.js";
import productRoutes from "./product.routes.js";

const router = express.Router();

// router.use("/users", userRoutes);
router.use("/workspaces", workspaceRoutes);
router.use("/content", contentRoutes);
// router.use("/roles", roleRoutes);
router.use("/plans", planRoutes);
router.use("/brands", brandRoutes);
router.use("/products", productRoutes);

export default router;

