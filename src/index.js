// src/index.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

import prisma from "./config/prismaClient.js";
import router from "./routes/index.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ——— resolve path project root (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, ".."); // src -> project root
const uploadDir = path.join(projectRoot, "uploads");

// ——— global middlewares
app.use(cors());
app.use(express.json());

// ——— serve static uploads (public)
app.use(
  "/uploads",
  express.static(uploadDir, {
    index: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

// ——— API routes (semua endpoint lewat routes/index.js, termasuk /uploads & /docs)
app.use("/api", router);

// ——— 404 fallback untuk API (opsional)
app.use("/api", (req, res, next) => {
  if (res.headersSent) return next();
  return res.status(404).json({ message: "API route not found" });
});

// ——— error handler (wajib di akhir)
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const payload = { message: err.message || "Internal Server Error" };
  if (process.env.NODE_ENV !== "production") payload.stack = err.stack;
  console.error("🔥 Error:", err);
  res.status(status).json(payload);
});

// ✅ Start server
async function startServer() {
  try {
    // pastikan folder uploads ada
    await fs.mkdir(uploadDir, { recursive: true });

    await prisma.$connect();
    console.log("✅ Database connected successfully!");

    app.listen(PORT, () => {
      console.log(`🚀 Express API running on port ${PORT}`);
      console.log(`📂 Uploads served at: http://localhost:${PORT}/uploads/<filename>`);
      console.log(`⬆️  Upload endpoint: POST http://localhost:${PORT}/api/uploads (form-data: files[])`);
      console.log(`📘 Docs JSON: http://localhost:${PORT}/api/docs/openapi.json`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to the database or start server:", error.message);
    process.exit(1);
  }
}

startServer();
