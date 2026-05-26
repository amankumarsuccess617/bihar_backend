import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { adminRefundPayment, getRefunds, approveRefund, rejectRefund } from "../controllers/refundController.js";

const router = express.Router();

// admin - get all refunds with optional status filter
router.get(
  "/",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getRefunds
);

// admin - refund a payment
router.post(
  "/payments/:paymentId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  adminRefundPayment
);

// admin - approve a refund request
router.post(
  "/:refundId/approve",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  approveRefund
);

// admin - reject a refund request
router.post(
  "/:refundId/reject",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  rejectRefund
);

export default router;