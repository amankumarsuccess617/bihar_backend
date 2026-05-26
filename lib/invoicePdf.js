import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function writeTaxInvoicePdf({ invoice, buyerExtraLines = [] }) {
  const pdfDir = path.join(process.cwd(), "uploads", "invoices");
  ensureDir(pdfDir);

  const fileName = `${invoice.invoiceNo.replace(/[^\w\-]+/g, "_")}.pdf`;
  const outPath = path.join(pdfDir, fileName);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    doc.fontSize(16).text("TAX INVOICE", { align: "center" });
    doc.moveDown();

    doc.fontSize(10).text(`Invoice No: ${invoice.invoiceNo}`);
    doc.text(`Date: ${new Date(invoice.createdAt).toISOString()}`);
    doc.moveDown();

    doc.fontSize(11).text("Seller (Department / Organization)");
    doc.fontSize(10).text(invoice.orgLegalName || "");
    if (invoice.orgGstin) doc.text(`GSTIN: ${invoice.orgGstin}`);
    if (invoice.orgAddress) doc.text(invoice.orgAddress || "");
    if (invoice.orgStateCode) doc.text(`State Code: ${invoice.orgStateCode}`);
    doc.moveDown();

    doc.fontSize(11).text("Buyer (Candidate snapshot)");
    doc.fontSize(10);
    if (invoice.buyerName) doc.text(`Name: ${invoice.buyerName}`);
    if (invoice.buyerEmail) doc.text(`Email: ${invoice.buyerEmail}`);
    if (invoice.buyerPhone) doc.text(`Phone: ${invoice.buyerPhone}`);
    if (invoice.buyerStateCode) doc.text(`State Code: ${invoice.buyerStateCode}`);
    for (const l of buyerExtraLines) doc.text(l);
    doc.moveDown();

    doc.fontSize(11).text("Payment details");
    doc.fontSize(10);
    doc.text(`Application No: ${invoice.applicationNoSnapshot || ""}`);
    doc.text(`Payment ID (internal): ${invoice.paymentIdSnapshot || ""}`);
    if (invoice.razorpayOrderId) doc.text(`Razorpay Order: ${invoice.razorpayOrderId}`);
    if (invoice.razorpayPaymentId) doc.text(`Razorpay Payment: ${invoice.razorpayPaymentId}`);
    doc.moveDown();

    doc.fontSize(11).text("Amounts");
    doc.fontSize(10);
    doc.text(`Currency: ${invoice.currency}`);
    doc.text(`Grand Total (inclusive): ₹ ${(invoice.grandTotalPaise / 100).toFixed(2)}`);
    doc.text(`Taxable Value: ₹ ${(invoice.taxablePaise / 100).toFixed(2)}`);
    doc.text(`CGST: ₹ ${(invoice.cgstPaise / 100).toFixed(2)}`);
    doc.text(`SGST: ₹ ${(invoice.sgstPaise / 100).toFixed(2)}`);
    doc.text(`IGST: ₹ ${(invoice.igstPaise / 100).toFixed(2)}`);
    doc.text(`Total Tax: ₹ ${(invoice.totalTaxPaise / 100).toFixed(2)}`);
    doc.text(`GST Rate: ${invoice.gstRatePct}%`);
    doc.moveDown();

    doc.fontSize(9).text(
      "This is a system-generated tax invoice for online fee payment. For support, contact the department helpline.",
      { align: "left" }
    );

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return { outPath, url: `/uploads/invoices/${fileName}` };
}