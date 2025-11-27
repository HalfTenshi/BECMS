// src/routes/upload.routes.js
import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { fileTypeFromBuffer } from "file-type";

import { auth } from "../middlewares/auth.js";
import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";
import assetService from "../modules/asset/asset.service.js";

const router = express.Router();

// 🔒 Semua upload bersifat non-public → wajib auth + workspace + RBAC
router.use(auth, workspaceContext);

// ----- Config dasar (bisa diatur via ENV) -----
const MAX_MB = Number(process.env.UPLOAD_MAX_MB ?? "5"); // default 5 MB per file
const MAX_FILES = Number(process.env.UPLOAD_MAX_FILES ?? "5"); // default 5 file sekali upload
const ALLOW_MIME = (process.env.UPLOAD_ALLOW_MIME ??
  "image/png,image/jpeg,image/webp")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ----- Setup multer (memory) -----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_MB * 1024 * 1024,
    files: MAX_FILES,
  },
});

// ----- Helper path root project -----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// routes/ -> src/ -> project root
const projectRoot = path.resolve(__dirname, "..", "..");
const uploadRoot = path.join(projectRoot, "uploads");

// ----- Utility: buat nama file acak -----
function randomNameWithExt(originalName = "", forcedExt = "") {
  const rand = crypto.randomBytes(10).toString("hex");
  const safeExt = forcedExt || path.extname(originalName || "").toLowerCase();
  return `${rand}${safeExt}`;
}

/* =========================
   POST /  (multi-file upload)
   form-data:
     - files[] (max MAX_FILES)
     - folder (opsional)
     - tags   (opsional, "tag1,tag2")
   ========================= */
router.post(
  "/",
  authorize(ACTIONS.CREATE, RESOURCES.UPLOADS),
  upload.array("files", MAX_FILES),
  async (req, res, next) => {
    try {
      if (!req.files?.length) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const workspaceId =
        req.workspaceId || req.workspace?.id || req.headers["x-workspace-id"];
      const userId = req.user?.id || null;

      if (!workspaceId) {
        return res
          .status(400)
          .json({ message: "workspaceId is required", code: "WORKSPACE_REQUIRED" });
      }

      // Folder root untuk semua uploads
      await fs.mkdir(uploadRoot, { recursive: true });

      // Pisahkan per workspace: /uploads/{workspaceId}/filename
      const wsUploadRoot = path.join(uploadRoot, workspaceId);
      await fs.mkdir(wsUploadRoot, { recursive: true });

      const saved = [];

      for (const f of req.files) {
        // Deteksi mime dari buffer — jangan percaya ekstensi saja
        const detected = await fileTypeFromBuffer(f.buffer);
        if (!detected) {
          throw new Error("Cannot detect file type");
        }
        const { mime, ext } = detected;

        if (!ALLOW_MIME.includes(mime)) {
          const err = new Error(`Mime not allowed: ${mime}`);
          err.status = 400;
          throw err;
        }

        const filename = randomNameWithExt(f.originalname, `.${ext}`);
        const outPath = path.join(wsUploadRoot, filename);

        await fs.writeFile(outPath, f.buffer, { flag: "wx" }); // fail if exists

        // (Opsional) ambil dimensi gambar bila paket 'image-size' terpasang
        let width = null;
        let height = null;
        if (mime.startsWith("image/")) {
          try {
            const { default: imageSize } = await import("image-size");
            const dim = imageSize(f.buffer);
            width = dim?.width ?? null;
            height = dim?.height ?? null;
          } catch {
            // abaikan jika image-size tidak terpasang
          }
        }

        // URL publik (sesuaikan dengan static serving di index.js)
        const url = `/uploads/${workspaceId}/${filename}`;

        // folder/tags bisa dikirim dari form-data (opsional)
        const folder =
          typeof req.body?.folder === "string" && req.body.folder.trim()
            ? req.body.folder.trim()
            : null;

        const extraTags =
          req.body?.tags != null
            ? String(req.body.tags)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [];

        // === Integrasi Media Library: buat record Asset ===
        const asset = await assetService.ingestOne({
          workspaceId,
          userId,
          fileMeta: {
            buffer: f.buffer,
            originalName: f.originalname,
            mime,
            size: f.size,
            outFilename: filename,
            url,
            width,
            height,
            folder,
            extraTags,
          },
        });

        saved.push(asset); // kembalikan data Asset, bukan sekadar URL
      }

      return res.json({ success: true, files: saved });
    } catch (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.message });
      }
      return next(err);
    }
  }
);

/* =========================
   GET /allow-mime  (opsional)
   Beritahu FE apa saja MIME yang diizinkan.
   ========================= */
router.get(
  "/allow-mime",
  authorize(ACTIONS.READ, RESOURCES.UPLOADS),
  (req, res) => {
    res.json({ allow: ALLOW_MIME, maxMB: MAX_MB, maxFiles: MAX_FILES });
  }
);

export default router;
