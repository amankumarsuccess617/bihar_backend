import crypto from "crypto";
import Razorpay from "razorpay";
import prisma from "../lib/prisma.js";
import { createOrGetInvoiceForPayment } from "../lib/invoiceService.js";
import {
  notifyPaymentSuccess,
  notifyPaymentFailed,
} from "../lib/notificationManager.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

function feeFromRules(feeRules, applicantData) {
  // feeRules example:
  // { "GENERAL": 50000, "OBC": 40000, "SC": 30000 } (paise)
  // applicantData example: { "category": "OBC" }
  const category = applicantData?.category || "GENERAL";
  const paise = feeRules?.[category] ?? feeRules?.GENERAL ?? 0;
  return Number(paise || 0);
}

// Candidate: create Razorpay order for an application
export const createOrder = async (req, res) => {
  const { applicationId } = req.body;
  if (!applicationId) return res.status(400).json({ message: "applicationId required" });

  const app = await prisma.application.findFirst({
    where: { id: Number(applicationId), userId: req.user.id },
    include: { post: true },
  });
  if (!app) return res.status(404).json({ message: "Application not found" });

  // calculate fee
  const amountPaise = feeFromRules(app.post.feeRules, app.data);
  if (amountPaise <= 0) return res.status(400).json({ message: "Fee not configured" });

  // create provider order
  const order = await razorpay.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: app.applicationNo,
    notes: { applicationId: String(app.id), applicationNo: app.applicationNo },
  });

  // persist payment row
  const payment = await prisma.payment.create({
    data: {
      applicationId: app.id,
      provider: "razorpay",
      orderId: order.id,
      amountPaise,
      currency: "INR",
      status: "CREATED",
      providerData: order,
    },
  });

  // move application to payment pending (optional)
  await prisma.application.update({
    where: { id: app.id },
    data: { status: "PAYMENT_PENDING" },
  });

  res.json({
    keyId: process.env.RAZORPAY_KEY_ID,
    orderId: order.id,
    amountPaise,
    currency: "INR",
    paymentId: payment.id,
    applicationNo: app.applicationNo,
  });
};

// Candidate: after client success, verify signature (recommended)
export const verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, applicationId } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !applicationId) {
    return res.status(400).json({ message: "missing fields" });
  }

  const app = await prisma.application.findFirst({
    where: { id: Number(applicationId), userId: req.user.id },
  });
  if (!app) return res.status(404).json({ message: "Application not found" });

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expected !== razorpay_signature) {
    await prisma.application.update({
      where: { id: app.id },
      data: { status: "PAYMENT_FAILED" },
    });
    // Send payment failed notification
    await notifyPaymentFailed(
      req.user,
      "Signature verification failed"
    ).catch((err) => console.error("[Payment Notification Error]", err));
    return res.status(400).json({ message: "Signature mismatch" });
  }

  // Get updated payment and application details for notification
  const payment = await prisma.payment.findFirst({
    where: { orderId: razorpay_order_id },
    orderBy: { id: "desc" },
  });

  const post = await prisma.post.findUnique({
    where: { id: app.postId },
  });

  // Send payment success notification
  await notifyPaymentSuccess(req.user, payment, app, post).catch((err) =>
    console.error("[Payment Success Notification Error]", err)
  );

  // update latest payment record with same orderId
  await prisma.payment.updateMany({
    where: { applicationId: app.id, provider: "razorpay", orderId: razorpay_order_id },
    data: {
      paymentId: razorpay_payment_id,
      status: "SUCCESS",
      providerData: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      },
    },
  });

  await prisma.application.update({
    where: { id: app.id },
    data: { status: "PAYMENT_SUCCESS" },
  });

  const payRow = await prisma.payment.findFirst({
    where: {
      applicationId: app.id,
      provider: "razorpay",
      orderId: razorpay_order_id,
      status: "SUCCESS",
    },
    orderBy: { id: "desc" },
  });
  if (payRow) {
    await createOrGetInvoiceForPayment(payRow.id).catch(() => {});
  }

  res.json({ ok: true });
};

// Candidate: get my payment history
export const getMyPayments = async (req, res) => {
  const userId = req.user.id;

  try {
    // Get all payments for this user's applications
    const payments = await prisma.payment.findMany({
      where: {
        application: {
          userId: userId,
        },
      },
      include: {
        application: {
          include: {
            post: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform the data to match frontend expectations
    const formattedPayments = payments.map((p) => {
      const post = p.application?.post;
      return {
        id: p.id,
        orderId: p.orderId,
        amount: Math.round(p.amountPaise / 100), // Convert paise to rupees
        status: p.status,
        paidAt: p.updatedAt,
        application: {
          rollNo: p.application?.rollNo || "N/A",
          post: {
            code: post?.code || "N/A",
            name: post?.name || "N/A",
          },
        },
      };
    });

    res.json(formattedPayments);
  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(500).json({ message: "Failed to fetch payments", error: err.message });
  }
};

// ADMIN: GET ALL PAYMENTS WITH OPTIONAL STATUS FILTER
export const getAllPayments = async (req, res) => {
  try {
    const status = req.query.status;

    const where = {};
    if (status && ["PENDING", "SUCCESS", "FAILED"].includes(String(status))) {
      where.status = String(status);
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        application: {
          include: {
            post: {
              include: {
                recruitment: true,
              },
            },
            user: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedPayments = payments.map((p) => {
      const post = p.application?.post;
      const user = p.application?.user;
      return {
        id: p.id,
        applicationId: p.applicationId,
        orderId: p.orderId,
        amount: Math.round(p.amountPaise / 100), // Convert paise to rupees
        status: p.status,
        paidAt: p.updatedAt,
        application: {
          id: p.application.id,
          applicationNo: p.application.applicationNo,
          rollNo: p.application.rollNo || "N/A",
          user: {
            name: user?.name || "N/A",
            email: user?.email || "N/A",
          },
          post: {
            code: post?.code || "N/A",
            name: post?.name || "N/A",
            recruitment: {
              code: post?.recruitment?.code || "N/A",
              title: post?.recruitment?.title || "N/A",
            },
          },
        },
      };
    });

    res.json(formattedPayments);
  } catch (err) {
    console.error("[Get All Payments]", err);
    res.status(500).json({ message: "Failed to fetch payments", error: err.message });
  }
};