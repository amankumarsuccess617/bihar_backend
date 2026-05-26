import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import prisma from "../lib/prisma.js";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writePdf({ title, lines, outPath }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    doc.fontSize(16).text(title, { align: "center" });
    doc.moveDown();

    doc.fontSize(11);
    for (const l of lines) doc.text(l);

    doc.end();

    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

// Candidate: generate application PDF
export const generateApplicationPdf = async (req, res) => {
  const applicationId = Number(req.params.applicationId);

  const app = await prisma.application.findFirst({
    where: { id: applicationId, userId: req.user.id },
    include: {
      user: true,
      post: { include: { recruitment: true } },
    },
  });
  if (!app) return res.status(404).json({ message: "Application not found" });

  const pdfDir = path.join(process.cwd(), "uploads", "pdfs");
  ensureDir(pdfDir);

  const fileName = `application_${app.applicationNo}.pdf`;
  const outPath = path.join(pdfDir, fileName);

  const lines = [
    `Application No: ${app.applicationNo}`,
    `Candidate: ${app.user.name}`,
    `Email: ${app.user.email}`,
    `Phone: ${app.user.phone || "-"}`,
    `Recruitment: ${app.post.recruitment.code} - ${app.post.recruitment.title}`,
    `Post: ${app.post.code} - ${app.post.name}`,
    `Status: ${app.status}`,
    `Submitted At: ${app.submittedAt ? new Date(app.submittedAt).toISOString() : "-"}`,
    "",
    "Form Data (JSON):",
    JSON.stringify(app.data || {}, null, 2),
    "",
    "Documents:",
    JSON.stringify(app.documents || [], null, 2),
  ];

  await writePdf({
    title: "Application Form",
    lines,
    outPath,
  });

  const url = `/uploads/pdfs/${fileName}`;
  res.json({ ok: true, url });
};

// Candidate: generate admit card PDF (only if admitCard exists)
export const generateAdmitCardPdf = async (req, res) => {
  const applicationId = Number(req.params.applicationId);

  const app = await prisma.application.findFirst({
    where: { id: applicationId, userId: req.user.id },
    include: {
      user: true,
      post: { include: { recruitment: true } },
      admitCard: true,
    },
  });
  if (!app || !app.admitCard) {
    return res.status(404).json({ message: "Admit card not found" });
  }

  const pdfDir = path.join(process.cwd(), "uploads", "pdfs");
  ensureDir(pdfDir);

  const fileName = `admitcard_${app.admitCard.rollNo}.pdf`;
  const outPath = path.join(pdfDir, fileName);

  const lines = [
    `Roll No: ${app.admitCard.rollNo}`,
    `Application No: ${app.applicationNo}`,
    `Candidate: ${app.user.name}`,
    `Recruitment: ${app.post.recruitment.code} - ${app.post.recruitment.title}`,
    `Post: ${app.post.code} - ${app.post.name}`,
    "",
    `Exam Center: ${app.admitCard.examCenter || "-"}`,
    `Exam Date: ${app.admitCard.examDate ? new Date(app.admitCard.examDate).toISOString() : "-"}`,
    `Shift: ${app.admitCard.shift || "-"}`,
    "",
    `QR Payload: ${app.admitCard.qrData || "-"}`,
  ];

  await writePdf({
    title: "Admit Card",
    lines,
    outPath,
  });

  const url = `/uploads/pdfs/${fileName}`;

  // store on admit card row
  await prisma.admitCard.update({
    where: { id: app.admitCard.id },
    data: { pdfUrl: url },
  });

  res.json({ ok: true, url });
};