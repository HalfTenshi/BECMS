import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import prisma from "./config/prismaClient.js";
import router from "./routes/index.js";
import { google } from "googleapis";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api", router);

// ✅ Cek koneksi database sebelum menjalankan server
async function startServer() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully!");

    app.listen(PORT, () => {
      console.log(`🚀 Express API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to the database:", error.message);
    process.exit(1); // hentikan proses jika gagal konek
  }
}

// Jalankan server
startServer();
