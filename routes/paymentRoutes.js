import express from "express";
import crypto from "crypto";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { createOrGetInvoiceForPayment } from "../lib/invoiceService.js";
import { createOrder, verifyPayment, getMyPayments, getAllPayments } from "../controllers/paymentController.js";

const router = express.Router();

// admin - get all payments with optional status filter
router.get(
  "/",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getAllPayments
);

router.get("/my", authMiddleware, getMyPayments);
router.post("/create-order", authMiddleware, createOrder);
router.post("/verify", authMiddleware, verifyPayment);

// webhook (NO auth middleware)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    if (!secret || !signature) return res.status(400).send("missing secret/signature");

    const expected = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    if (expected !== signature) return res.status(400).send("invalid signature");

    const event = JSON.parse(req.body.toString("utf8"));

    // -------------------------
    // payment.captured
    // -------------------------
    if (event?.event === "payment.captured") {
      const orderId = event?.payload?.payment?.entity?.order_id;
      const paymentId = event?.payload?.payment?.entity?.id;

      if (orderId) {
        const pay = await prisma.payment.findFirst({
          where: { provider: "razorpay", orderId },
        });

        if (pay) {
          await prisma.payment.update({
            where: { id: pay.id },
            data: { paymentId, status: "SUCCESS", providerData: event },
          });

          await prisma.application.update({
            where: { id: pay.applicationId },
            data: { status: "PAYMENT_SUCCESS" },
          });

          await createOrGetInvoiceForPayment(pay.id).catch(() => {});
        }
      }
    }

    // -------------------------
    // Refund events (Razorpay)
    // Note: subscribed events naming can vary by dashboard subscription.
    // Common ones: refund.created / refund.processed / refund.failed
    // Also sometimes: payment.failed (not refunds)
    // -------------------------
    if (
      event?.event === "refund.created" ||
      event?.event === "refund.processed" ||
      event?.event === "refund.failed"
    ) {
      const rzRefund = event?.payload?.refund?.entity;

      const rzRefundId = rzRefund?.id ? String(rzRefund.id) : null;
      const rzPaymentId = rzRefund?.payment_id ? String(rzRefund.payment_id) : null;
      const amountPaise = Number(rzRefund?.amount || 0);
      const refundStatusRaw = rzRefund?.status ? String(rzRefund.status).toUpperCase() : "";

      if (rzRefundId && rzPaymentId && amountPaise > 0) {
        const pay = await prisma.payment.findFirst({
          where: { provider: "razorpay", paymentId: rzPaymentId },
        });

        if (pay) {
          // Upsert-ish: find existing refund record by rzRefundId
          const existing = await prisma.refund.findFirst({
            where: {
              razorpayRefundId: rzRefundId,
            },
          });

          const normalizedStatus =
            refundStatusRaw.includes("PROCESS") ||
            refundStatusRaw === "CREATED"
              ? "PROCESSING"
              : refundStatusRaw.includes("SUCCESS") || refundStatusRaw === "PROCESSED"
              ? "SUCCEEDED"
              : refundStatusRaw.includes("FAIL") || refundStatusRaw === "FAILED"
              ? "FAILED"
              : refundStatusRaw || "UNKNOWN";

          if (!existing) {
            await prisma.refund.create({
              data: {
                paymentId: pay.id,
                razorpayRefundId: rzRefundId,
                amountPaise,
                currency: pay.currency || "INR",
                status: normalizedStatus,
                notes: rzRefund || event,
              },
            });
          } else {
            await prisma.refund.update({
              where: { id: existing.id },
              data: {
                status: normalizedStatus,
                notes: rzRefund || event,
              },
            });
          }

          // Compute total refunded (only count successful refunds if you prefer)
          const succeededSum = await prisma.refund.aggregate({
            where: {
              paymentId: pay.id,
              status: { in: ["SUCCEEDED", "PROCESSED"] }, // keep flexible naming
            },
            _sum: { amountPaise: true },
          });

          // If you want strict statuses, enforce only ["SUCCEEDED"] after you normalize uniformly.
          // Safer aggregator: sum all refunds excluding FAILED
          const nonFailedSum = await prisma.refund.aggregate({
            where: {
              paymentId: pay.id,
              status: { notIn: ["FAILED"] },
            },
            _sum: { amountPaise: true },
          });

          const refunded = nonFailedSum._sum.amountPaise || 0;

          let nextPaymentStatus = pay.status;
          if (refunded >= pay.amountPaise && pay.amountPaise > 0) {
            nextPaymentStatus = "REFUNDED";

            await prisma.application.update({
              where: { id: pay.applicationId },
              data: { status: "DRAFT" }, // or "PAYMENT_FAILED" depending on dept policy
            });
          } else if (refunded > 0) {
            nextPaymentStatus = "PARTIALLY_REFUNDED";
          }

          await prisma.payment.update({
            where: { id: pay.id },
            data: { status: nextPaymentStatus, providerData: event },
          });
        }
      }
    }

    res.json({ ok: true });
  }
);

export default router;