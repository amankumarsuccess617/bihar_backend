import prisma from "../lib/prisma.js";

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

// GET /api/finance/summary?from=&to=
export const financeSummary = async (req, res) => {
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);

  const createdAtFilter =
    from || to
      ? {
          gte: from || undefined,
          lte: to || undefined,
        }
      : undefined;

  const [paymentAgg, invoices, refundsAgg] = await Promise.all([
    prisma.payment.groupBy({
      by: ["status"],
      where: createdAtFilter ? { createdAt: createdAtFilter } : {},
      _count: { _all: true },
      _sum: { amountPaise: true },
    }),

    prisma.invoice.aggregate({
      where: createdAtFilter ? { createdAt: createdAtFilter } : {},
      _count: { _all: true },
      _sum: { grandTotalPaise: true },
    }),

    prisma.refund.groupBy({
      by: ["status"],
      where: createdAtFilter ? { createdAt: createdAtFilter } : {},
      _count: { _all: true },
      _sum: { amountPaise: true },
    }),
  ]);

  res.json({
    range: { from, to },
    payments: paymentAgg.map((p) => ({
      status: p.status,
      count: p._count._all,
      amountPaise: p._sum.amountPaise || 0,
      amountINR: ((p._sum.amountPaise || 0) / 100).toFixed(2),
    })),
    invoices: {
      count: invoices._count._all,
      totalGrandPaise: invoices._sum.grandTotalPaise || 0,
      totalGrandINR: ((invoices._sum.grandTotalPaise || 0) / 100).toFixed(2),
    },
    refunds: refundsAgg.map((r) => ({
      status: r.status,
      count: r._count._all,
      amountPaise: r._sum.amountPaise || 0,
      amountINR: ((r._sum.amountPaise || 0) / 100).toFixed(2),
    })),
  });
};

// GET /api/finance/payments.csv?from=&to=&status=
export const exportPaymentsCsv = async (req, res) => {
  const { Parser } = await import("json2csv");
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  const status = req.query.status ? String(req.query.status) : undefined;

  const payments = await prisma.payment.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(from || to ? { createdAt: { gte: from || undefined, lte: to || undefined } } : {}),
    },
    orderBy: { id: "desc" },
    include: {
      application: {
        select: { id: true, applicationNo: true, status: true },
      },
    },
    take: 20000,
  });

  const rows = payments.map((p) => ({
    paymentId: p.id,
    applicationId: p.applicationId,
    applicationNo: p.application.applicationNo,
    appStatus: p.application.status,
    provider: p.provider,
    orderId: p.orderId || "",
    rzPaymentId: p.paymentId || "",
    status: p.status,
    amountPaise: p.amountPaise,
    amountINR: (p.amountPaise / 100).toFixed(2),
    currency: p.currency,
    createdAt: p.createdAt.toISOString(),
  }));

  const parser = new Parser({ fields: Object.keys(rows[0] || { paymentId: "" }) });
  const csv = parser.parse(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=payments.csv");
  res.send(csv);
};

// GET /api/finance/refunds.csv?from=&to=
export const exportRefundsCsv = async (req, res) => {
  const { Parser } = await import("json2csv");
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);

  const refunds = await prisma.refund.findMany({
    where: from || to ? { createdAt: { gte: from || undefined, lte: to || undefined } } : {},
    orderBy: { id: "desc" },
    include: {
      payment: {
        select: {
          id: true,
          provider: true,
          paymentId: true,
          orderId: true,
          amountPaise: true,
          currency: true,
          applicationId: true,
        },
      },
    },
    take: 20000,
  });

  const rows = refunds.map((r) => ({
    refundId: r.id,
    refundStatus: r.status,
    razorpayRefundId: r.razorpayRefundId || "",
    refundAmountPaise: r.amountPaise,
    refundAmountINR: (r.amountPaise / 100).toFixed(2),
    paymentId: r.paymentId,
    rzPaymentId: r.payment.paymentId || "",
    rzOrderId: r.payment.orderId || "",
    provider: r.payment.provider,
    applicationId: r.payment.applicationId,
    currency: r.currency,
    createdAt: r.createdAt.toISOString(),
  }));

  const parser = new Parser({ fields: Object.keys(rows[0] || { refundId: "" }) });
  const csv = parser.parse(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=refunds.csv");
  res.send(csv);
};

// GET /api/finance/invoices.csv?from=&to=
export const exportInvoicesCsv = async (req, res) => {
  const { Parser } = await import("json2csv");
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);

  const invoices = await prisma.invoice.findMany({
    where: from || to ? { createdAt: { gte: from || undefined, lte: to || undefined } } : {},
    orderBy: { id: "desc" },
    include: {
      application: { select: { applicationNo: true } },
      payment: { select: { paymentId: true, orderId: true, status: true } },
    },
    take: 20000,
  });

  const rows = invoices.map((inv) => ({
    invoiceNo: inv.invoiceNo,
    invoicePdf: inv.pdfUrl || "",
    grandTotalPaise: inv.grandTotalPaise,
    grandTotalINR: (inv.grandTotalPaise / 100).toFixed(2),
    taxableINR: (inv.taxablePaise / 100).toFixed(2),
    cgstINR: (inv.cgstPaise / 100).toFixed(2),
    sgstINR: (inv.sgstPaise / 100).toFixed(2),
    igstINR: (inv.igstPaise / 100).toFixed(2),
    gstRatePct: inv.gstRatePct,
    buyerGstStateCode: inv.buyerStateCode || "",
    rzPaymentId: inv.payment?.paymentId || "",
    rzOrderId: inv.payment?.orderId || "",
    paymentStatus: inv.payment?.status || "",
    applicationNo: inv.application.applicationNo,
    createdAt: inv.createdAt.toISOString(),
  }));

  const parser = new Parser({ fields: Object.keys(rows[0] || { invoiceNo: "" }) });
  const csv = parser.parse(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=invoices.csv");
  res.send(csv);
};