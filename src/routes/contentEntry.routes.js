// src/routes/contentEntry.routes.js
import express from "express";
import { body } from "express-validator";

import { validate } from "../middlewares/validate.js";
import { auth } from "../middlewares/auth.js";
import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";

import contentEntryController from "../modules/content/contentEntry.controller.js";

const router = express.Router();

// ———————————————————————————————————
// Proteksi global
router.use(auth, workspaceContext);

// ———————————————————————————————————
// Validasi SEO dan field body
const seoRules = [
  body("metaDescription")
    .optional()
    .isString()
    .withMessage("metaDescription must be a string")
    .isLength({ max: 160 })
    .withMessage("metaDescription max 160 characters"),
  body("keywords")
    .optional()
    .custom((value) => {
      if (Array.isArray(value)) return true;
      if (typeof value === "string") return true; // "a,b,c" diizinkan
      throw new Error(
        "keywords must be an array of strings or a comma-separated string"
      );
    }),
];

// ———————————————————————————————————
// Routes CRUD untuk Content Entries
router.get(
  "/",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_ENTRIES),
  (req, res) => contentEntryController.getAll(req, res)
);

router.get(
  "/:id",
  authorize(ACTIONS.READ, RESOURCES.CONTENT_ENTRIES),
  (req, res) => contentEntryController.getById(req, res)
);

router.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.CONTENT_ENTRIES),
  seoRules,
  validate,
  (req, res) => contentEntryController.create(req, res)
);

router.put(
  "/:id",
  authorize(ACTIONS.UPDATE, RESOURCES.CONTENT_ENTRIES),
  seoRules,
  validate,
  (req, res) => contentEntryController.update(req, res)
);

router.delete(
  "/:id",
  authorize(ACTIONS.DELETE, RESOURCES.CONTENT_ENTRIES),
  (req, res) => contentEntryController.delete(req, res)
);

router.patch(
  "/:id/publish",
  authorize(ACTIONS.PUBLISH, RESOURCES.CONTENT_ENTRIES),
  (req, res) => contentEntryController.publish(req, res)
);

export default router;
