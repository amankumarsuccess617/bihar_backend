import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import {
  exportApplicationsCsv,
  exportResultsCsv,
  getReports,
  generateReport,
} from "../controllers/reportController.js";

const router = express.Router();

// admin - generate new report
router.post(
  "/generate",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  generateReport
);

// admin - generate new report (alternative route)
router.post(
  "/",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  generateReport
);

// admin - get all reports
router.get(
  "/",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getReports
);

router.get(
  "/applications.csv",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  exportApplicationsCsv
);

router.get(
  "/results.csv",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  exportResultsCsv
);

export default router;
