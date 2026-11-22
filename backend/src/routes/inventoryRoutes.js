
import { Router } from "express";
import {
  listInventory,
  createInventory,
  updateInventory,
  restockInventory
} from "../controllers/inventoryController.js";

import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

// Owner and staff can view inventory
router.get("/", listInventory);

// Only owners can manage inventory
router.post("/", authorize("OWNER"), createInventory);
router.patch("/:id", authorize("OWNER"), updateInventory);
router.post("/:id/restock", authorize("OWNER"), restockInventory);

export default router;
