import { Router } from "express";
import { dailyReport, saveReconciliation, reconciliationHistory } from "../controllers/reportController.js";
import { authenticate, authorize } from "../middleware/auth.js";
const router = Router();
router.use(authenticate, authorize("OWNER"));
router.get("/daily", dailyReport);
router.get("/reconciliations", reconciliationHistory);
router.post("/reconciliations", saveReconciliation);
export default router;
