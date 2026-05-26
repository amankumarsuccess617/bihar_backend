import { createRazorpayRefund } from "../lib/refundService.js";
import prisma from "../lib/prisma.js";

export const adminRefundPayment = async (req, res) => {
  const paymentId = Number(req.params.paymentId);
  const { amountPaise, reason, notes } = req.body;

  if (!amountPaise || amountPaise <= 0) {
    return res.status(400).json({ message: "amountPaise required" });
  }

  const rf = await createRazorpayRefund({ paymentDbId: paymentId, amountPaise, reason, notes });
  res.json(rf);
};

// ADMIN: GET ALL REFUNDS WITH OPTIONAL STATUS FILTER
export const getRefunds = async (req, res) => {
  try {
    const status = req.query.status;

    const where = {};
    if (status && ["PENDING", "APPROVED", "REJECTED", "COMPLETED"].includes(String(status))) {
      where.status = String(status);
    }

    const refunds = await prisma.refund.findMany({
      where,
      include: {
        payment: {
          include: {
            application: {
              include: {
                post: true,
                user: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formatted = refunds.map((r) => ({
      id: r.id,
      paymentId: r.paymentId,
      applicationId: r.payment.applicationId,
      status: r.status,
      amount: r.amountPaise ? r.amountPaise / 100 : 0,
      reason: r.reason,
      requestedAt: r.createdAt,
      processedAt: r.updatedAt,
      application: {
        id: r.payment.application.id,
        applicationNo: r.payment.application.applicationNo,
        post: {
          code: r.payment.application.post.code,
          name: r.payment.application.post.name,
        },
        user: {
          name: r.payment.application.user?.name || "N/A",
          email: r.payment.application.user?.email || "N/A",
        },
      },
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("[Get Refunds]", error);
    return res.status(500).json({
      message: "Failed to fetch refunds",
      error: error.message,
    });
  }
};

// ADMIN: APPROVE REFUND REQUEST
export const approveRefund = async (req, res) => {
  try {
    const refundId = Number(req.params.refundId);

    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      return res.status(404).json({ message: "Refund not found" });
    }

    const updated = await prisma.refund.update({
      where: { id: refundId },
      data: {
        status: "APPROVED",
      },
      include: {
        payment: {
          include: {
            application: {
              include: {
                post: true,
              },
            },
          },
        },
      },
    });

    return res.json({
      message: "Refund approved successfully",
      refund: updated,
    });
  } catch (error) {
    console.error("[Approve Refund]", error);
    return res.status(500).json({
      message: "Failed to approve refund",
      error: error.message,
    });
  }
};

// ADMIN: REJECT REFUND REQUEST
export const rejectRefund = async (req, res) => {
  try {
    const refundId = Number(req.params.refundId);
    const { reason } = req.body;

    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      return res.status(404).json({ message: "Refund not found" });
    }

    const updated = await prisma.refund.update({
      where: { id: refundId },
      data: {
        status: "REJECTED",
        reason: reason || refund.reason,
      },
      include: {
        payment: {
          include: {
            application: {
              include: {
                post: true,
              },
            },
          },
        },
      },
    });

    return res.json({
      message: "Refund rejected successfully",
      refund: updated,
    });
  } catch (error) {
    console.error("[Reject Refund]", error);
    return res.status(500).json({
      message: "Failed to reject refund",
      error: error.message,
    });
  }
};