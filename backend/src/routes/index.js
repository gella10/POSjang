import { Router } from "express";
import authRoutes from "./authRoutes.js";
import menuRoutes from "./menuRoutes.js";
import orderRoutes from "./orderRoutes.js";
import reportRoutes from "./reportRoutes.js";
import inventoryRoutes from "./inventoryRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/menu", menuRoutes);
router.use("/orders", orderRoutes);
router.use("/reports", reportRoutes);
router.use("/inventory", inventoryRoutes);

export default router;