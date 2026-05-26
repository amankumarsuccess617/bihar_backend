import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import {
  financeSummary,
  exportPaymentsCsv,
  exportRefundsCsv,
  exportInvoicesCsv,
} from "../controllers/financeController.js";

const router = express.Router();

router.get(
  "/summary",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  financeSummary
);

router.get(
  "/payments.csv",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  exportPaymentsCsv
);

router.get(
  "/refunds.csv",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  exportRefundsCsv
);

router.get(
  "/invoices.csv",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  exportInvoicesCsv
);

export default router;