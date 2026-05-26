import Razorpay from "razorpay";
import prisma from "./prisma.js";

const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export async function createRazorpayRefund({ paymentDbId, amountPaise, reason, notes }) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentDbId } });

  if (!payment) throw new Error("Payment not found");
  if (payment.provider !== "razorpay") throw new Error("Only razorpay supported");
  if (payment.status !== "SUCCESS") throw new Error("Payment not successful");

  if (!payment.paymentId) throw new Error("Missing razorpay payment id");

  const alreadyRefundedPaise = await prisma.refund.aggregate({
    where: { paymentId: paymentDbId, status: "SUCCEEDED" },
    _sum: { amountPaise: true },
  });
  const refunded = alreadyRefundedPaise._sum.amountPaise || 0;

  if (refunded + amountPaise > payment.amountPaise) {
    throw new Error("Refund amount exceeds paid amount");
  }

  await prisma.payment.update({
    where: { id: paymentDbId },
    data: { status: "REFUND_PENDING" },
  });

  const refundDb = await prisma.refund.create({
    data: {
      paymentId: paymentDbId,
      amountPaise,
      currency: payment.currency || "INR",
      reason: reason || null,
      notes: notes || null,
      status: "PROCESSING",
    },
  });

  try {
    const rz = await rzp.payments.refund(payment.paymentId, {
      amount: amountPaise, // Razorpay amount in smallest currency unit
      notes,
      ...(reason ? { speed: "normal" } : {}), // razorpay allows extra fields depends on API version
      // receipt/not needed
    });

    const updatedRefund = await prisma.refund.update({
      where: { id: refundDb.id },
      data: {
        razorpayRefundId: rz?.id ? String(rz.id) : null,
        status: String(rz?.status || "CREATED"),
        notes: rz || null,
      },
    });

    return updatedRefund;
  } catch (e) {
    await prisma.payment.update({
      where: { id: paymentDbId },
      data: { status: "SUCCESS" }, // rollback pending if failed to initiate
    });
    await prisma.refund.update({
      where: { id: refundDb.id },
      data: { status: "FAILED", notes: { error: String(e?.message || e) } },
    });
    throw e;
  }
}