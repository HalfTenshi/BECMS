import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { fileTypeFromBuffer } from "file-type";

import { auth } from "../middlewares/auth.js"; // pakai named import sesuai snippet kamu
import workspaceContext from "../middlewares/workspaceContext.js";
import { authorize } from "../middlewares/authorize.js";
import { ACTIONS, RESOURCES } from "../constants/permissions.js";
import assetService from "../modules/asset/asset.service.js";

const router = express.Router();

// 🔒 Semua upload bersifat non-public → wajib auth + workspace + RBAC
router.use(auth, workspaceContext);

// ----- Config dasar (bisa diatur via ENV) -----
const MAX_MB = Number(process.env.UPLOAD_MAX_MB ?? "5");       // default 5 MB per file
const MAX_FILES = Number(process.env.UPLOAD_MAX_FILES ?? "5"); // default 5 file sekali upload
const ALLOW_MIME = (process.env.UPLOAD_ALLOW_MIME ?? "image/png,image/jpeg,image/webp")
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
const projectRoot = path.resolve(__dirname, "../../.."); // routes/ -> src/ -> project root
const uploadRoot = path.join(projectRoot, "uploads");

// ----- Utility: buat nama file acak -----
function randomNameWithExt(originalName = "", forcedExt = "") {
  const rand = crypto.randomBytes(10).toString("hex");
  const safeExt = forcedExt || path.extname(originalName || "").toLowerCase();
  return `${rand}${safeExt}`;
}

/* =========================
   POST /  (multi-file)
   form-data: files[] (max MAX_FILES)
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

      await fs.mkdir(uploadRoot, { recursive: true });

      const workspaceId =
        req.workspace?.id || req.ctx?.workspaceId || req.headers["x-workspace-id"];
      const userId = req.user?.id || null;

      const saved = [];
      for (const f of req.files) {
        // Deteksi mime dari buffer — jangan percaya ekstensi saja
        const detected = await fileTypeFromBuffer(f.buffer);
        if (!detected) {
          throw new Error("Cannot detect file type");
        }
        const { mime, ext } = detected;

        if (!ALLOW_MIME.includes(mime)) {
          throw new Error(`Mime not allowed: ${mime}`);
        }

        const filename = randomNameWithExt(f.originalname, `.${ext}`);
        const outPath = path.join(uploadRoot, filename);

        await fs.writeFile(outPath, f.buffer, { flag: "wx" }); // fail if exists

        // (Opsional) ambil dimensi gambar bila paket 'image-size' terpasang
        let width = null, height = null;
        if (mime.startsWith("image/")) {
          try {
            const { imageSize } = await import("image-size");
            const dim = imageSize(f.buffer);
            width = dim?.width ?? null;
            height = dim?.height ?? null;
          } catch {
            // abaikan jika image-size tidak terpasang
          }
        }

        const url = `/uploads/${filename}`;

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
            // folder/tags bisa dikirim dari form-data (opsional)
            folder: req.body?.folder || null,
            extraTags: req.body?.tags
              ? String(req.body.tags).split(",").map((s) => s.trim()).filter(Boolean)
              : [],
          },
        });

        saved.push(asset); // kembalikan data Asset, bukan sekadar URL
      }

      return res.json({ files: saved });
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
   ========================= */
router.get(
  "/allow-mime",
  authorize(ACTIONS.READ, RESOURCES.UPLOADS),
  (req, res) => {
    res.json({ allow: ALLOW_MIME, maxMB: MAX_MB, maxFiles: MAX_FILES });
  }
);

export default router;
