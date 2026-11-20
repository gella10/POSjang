import { Router } from "express";
import { createOrder, listOrders } from "../controllers/orderController.js";
import { authenticate } from "../middleware/auth.js";
const router = Router();
router.use(authenticate);
router.get("/", listOrders);
router.post("/", createOrder);
export default router;
