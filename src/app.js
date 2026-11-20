import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();
app.use(cors({
  origin: process.env.CLIENT_ORIGIN?.split(",").map(x=>x.trim()) || "http://localhost:5173"
}));
app.use(express.json({ limit: "1mb" }));
app.get("/api/health", (_req,res)=>res.json({ status:"ok", service:"pojangmacha-api" }));
app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);
export default app;
