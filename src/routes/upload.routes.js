// src/routes/upload.routes.js
import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { fileTypeFromBuffer } from "file-type";

const router = express.Router();

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
const projectRoot = path.resolve(__dirname, "../../.."); // adjust: routes/ -> src/ -> project root
const uploadRoot = path.join(projectRoot, "uploads");

// ----- Utility: buat nama file acak (pertahankan ekstensi asli jika ada) -----
function randomNameWithExt(originalName = "", forcedExt = "") {
  const rand = crypto.randomBytes(10).toString("hex");
  const safeExt = forcedExt || path.extname(originalName || "").toLowerCase();
  return `${rand}${safeExt}`;
}

// ----- POST / (multi-file) -----
// form-data: files[] (max MAX_FILES)
router.post("/", upload.array("files", MAX_FILES), async (req, res, next) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    await fs.mkdir(uploadRoot, { recursive: true });

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
      saved.push({
        url: `/uploads/${filename}`,
        mime,
        size: f.size,
        filename,
      });
    }

    return res.json({ files: saved });
  } catch (err) {
    // Multer error format atau general error
    if (err instanceof multer.MulterError) {
      // LIMIT_FILE_SIZE, LIMIT_FILE_COUNT, etc.
      return res.status(400).json({ message: err.message });
    }
    return next(err);
  }
});

// ----- GET /allow-mime (opsional) -----
// biar FE tahu mime apa saja yang diterima
router.get("/allow-mime", (req, res) => {
  res.json({ allow: ALLOW_MIME, maxMB: MAX_MB, maxFiles: MAX_FILES });
});

export default router;
