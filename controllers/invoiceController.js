import prisma from "../lib/prisma.js";
import { createOrGetInvoiceForPayment } from "../lib/invoiceService.js";

export const myInvoiceByApplication = async (req, res) => {
  const applicationId = Number(req.params.applicationId);

  const app = await prisma.application.findFirst({
    where: { id: applicationId, userId: req.user.id },
    include: {
      payments: { orderBy: { id: "desc" }, take: 5 },
      invoice: true,
    },
  });
  if (!app) return res.status(404).json({ message: "Application not found" });

  // pick latest SUCCESS payment
  const pay = app.payments.find((p) => p.status === "SUCCESS");
  if (!pay) return res.status(404).json({ message: "No successful payment" });

  const inv = await createOrGetInvoiceForPayment(pay.id); // creates if missing
  res.json(inv);
};

export const adminRegenerateInvoice = async (req, res) => {
  const paymentId = Number(req.params.paymentId);
  const inv = await createOrGetInvoiceForPayment(paymentId);
  res.json(inv);
};