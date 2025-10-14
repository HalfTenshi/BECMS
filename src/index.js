import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import prisma from "./config/prismaClient.js";
import router from "./routes/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api", router);

app.listen(PORT, () => {
  console.log(`✅ Express API running in port: ${PORT}`);
});
