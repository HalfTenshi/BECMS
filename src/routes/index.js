import express from "express";
// import userRoutes from "./user.routes.js";
// import workspaceRoutes from "./workspace.routes.js";
import contentRoutes from "./content.routes.js";
// import roleRoutes from "./role.routes.js";
// import planRoutes from "./plan.routes.js";

const router = express.Router();

// router.use("/users", userRoutes);
// router.use("/workspaces", workspaceRoutes);
router.use("/content", contentRoutes);
// router.use("/roles", roleRoutes);
// router.use("/plans", planRoutes);

export default router;
