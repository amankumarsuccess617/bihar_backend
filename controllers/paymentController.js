import prisma from "../lib/prisma.js";
import { createOrGetInvoiceForPayment } from "../lib/invoiceService.js";
import {
  notifyPaymentSuccess,
  notifyPaymentFailed,
} from "../lib/notificationManager.js";
import {
  getPaymentClient,
  verifyPaymentSignature,
} from "../lib/paymentProvider.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";

function feeFromRules(feeRules, applicantData) {
  const category = applicantData?.category || "GENERAL";
  const paise = feeRules?.[category] ?? feeRules?.GENERAL ?? 0;
  return Number(paise || 0);
}

export const createOrder = async (req, res, next) => {
  try {
    const { applicationId } = req.body;
    if (!applicationId) {
      throw new AppError("applicationId required", 400);
    }

    const app = await prisma.application.findFirst({
      where: { id: Number(applicationId), userId: req.user.id },
      include: { post: true },
    });
    if (!app) {
      throw new AppError("Application not found", 404);
    }

    const amountPaise = feeFromRules(app.post.feeRules, app.data);
    if (amountPaise <= 0) {
      throw new AppError("Fee not configured", 400);
    }

    const razorpay = getPaymentClient();
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: app.applicationNo,
      notes: { applicationId: String(app.id), applicationNo: app.applicationNo },
    });

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
  } catch (err) {
    logger.error("create_order_failed", { message: err.message });
    next(err instanceof AppError ? err : new AppError("Failed to create order", 500));
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      applicationId,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !applicationId
    ) {
      throw new AppError("missing fields", 400);
    }

    const app = await prisma.application.findFirst({
      where: { id: Number(applicationId), userId: req.user.id },
    });
    if (!app) {
      throw new AppError("Application not found", 404);
    }

    const valid = verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!valid) {
      await prisma.application.update({
        where: { id: app.id },
        data: { status: "PAYMENT_FAILED" },
      });
      try {
        await notifyPaymentFailed(req.user, "Signature verification failed");
      } catch (err) {
        logger.error("payment_notification_failed", { message: err.message });
      }
      throw new AppError("Signature mismatch", 400);
    }

    const payment = await prisma.payment.findFirst({
      where: { orderId: razorpay_order_id },
      orderBy: { id: "desc" },
    });

    const post = await prisma.post.findUnique({
      where: { id: app.postId },
    });

    try {
      await notifyPaymentSuccess(req.user, payment, app, post);
    } catch (err) {
      logger.error("payment_success_notification_failed", { message: err.message });
    }

    await prisma.payment.updateMany({
      where: {
        applicationId: app.id,
        provider: "razorpay",
        orderId: razorpay_order_id,
      },
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
  } catch (err) {
    logger.error("verify_payment_failed", { message: err.message });
    next(err instanceof AppError ? err : new AppError("Failed to verify payment", 500));
  }
};

export const getMyPayments = async (req, res, next) => {
  const userId = req.user.id;

  try {
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

    const formattedPayments = payments.map((p) => {
      const post = p.application?.post;
      return {
        id: p.id,
        orderId: p.orderId,
        amount: Math.round(p.amountPaise / 100),
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
    logger.error("get_my_payments_failed", { message: err.message });
    next(new AppError("Failed to fetch payments", 500));
  }
};

export const getAllPayments = async (req, res, next) => {
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
        amount: Math.round(p.amountPaise / 100),
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
    logger.error("get_all_payments_failed", { message: err.message });
    next(new AppError("Failed to fetch payments", 500));
  }
};
