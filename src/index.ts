const express = require("express");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

dotenv.config();
const PORT = process.env.PORT;





app.listen(PORT,()=>{
    console.log("express API running in port:"+PORT);
});

