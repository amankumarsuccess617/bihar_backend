import prisma from "./prisma.js";
import { splitGstFromInclusiveTotal, nextInvoiceNo } from "./gstInvoice.js";
import { writeTaxInvoicePdf } from "./invoicePdf.js";

export async function createOrGetInvoiceForPayment(paymentId) {
  const existing = await prisma.invoice.findUnique({ where: { paymentId } });
  if (existing) return existing;

  const pay = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { application: { include: { user: true, post: { include: { recruitment: true } } } } },
  });
  if (!pay) throw new Error("Payment not found");
  if (pay.status !== "SUCCESS") throw new Error("Payment not successful");

  const app = pay.application;
  const user = app.user;

  const buyerStateCode =
    app.data?.stateCode ||
    app.data?.buyerStateCode ||
    app.data?.state ||
    null; // best-effort; prefer 2-digit code in data

  const gstRatePct = Number(process.env.DEFAULT_GST_RATE_PCT || 18);

  const split = splitGstFromInclusiveTotal({
    grandTotalPaise: pay.amountPaise,
    gstRatePct,
    orgStateCode: process.env.ORG_STATE_CODE,
    buyerStateCode,
  });

  const invoiceNo = await nextInvoiceNo(prisma);

  const inv = await prisma.invoice.create({
    data: {
      invoiceNo,
      paymentId: pay.id,
      applicationId: app.id,

      buyerName: user.name,
      buyerEmail: user.email,
      buyerPhone: user.phone,
      buyerStateCode: buyerStateCode ? String(buyerStateCode) : null,

      currency: pay.currency || "INR",
      amountPaise: pay.amountPaise,

      taxablePaise: split.taxablePaise,
      cgstPaise: split.cgstPaise,
      sgstPaise: split.sgstPaise,
      igstPaise: split.igstPaise,
      totalTaxPaise: split.totalTaxPaise,
      grandTotalPaise: pay.amountPaise,

      gstRatePct,

      orgLegalName: process.env.ORG_LEGAL_NAME || "Organization",
      orgGstin: process.env.ORG_GSTIN || null,
      orgAddress: process.env.ORG_ADDRESS || null,
      orgStateCode: process.env.ORG_STATE_CODE || null,

      razorpayOrderId: pay.orderId,
      razorpayPaymentId: pay.paymentId,
    },
  });

  const pdfObj = {
    ...inv,
    applicationNoSnapshot: app.applicationNo,
    paymentIdSnapshot: String(pay.id),
  };

  const { url } = await writeTaxInvoicePdf({ invoice: pdfObj });

  return prisma.invoice.update({
    where: { id: inv.id },
    data: { pdfUrl: url },
  });
}