const express = require("express");
const dotenv = require("dotenv");
const app = express();
const  prisma  = require("./db");

dotenv.config();
const PORT = process.env.PORT;

app.use(express.json());




app.listen(PORT,()=>{
    console.log("express API running in port:"+PORT);
});

