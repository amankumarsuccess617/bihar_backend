import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { myInvoiceByApplication, adminRegenerateInvoice } from "../controllers/invoiceController.js";

const router = express.Router();

router.get("/application/:applicationId", authMiddleware, myInvoiceByApplication);

router.post(
  "/regenerate/payment/:paymentId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  adminRegenerateInvoice
);

export default router;