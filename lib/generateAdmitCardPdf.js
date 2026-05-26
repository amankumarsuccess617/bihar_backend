import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export async function generateAdmitCardPdf(data) {

  const uploadsDir = path.join(process.cwd(), "uploads", "admitcards");

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileName = `${data.rollNo}.pdf`;

  const filePath = path.join(uploadsDir, fileName);

  const pdfUrl = `/uploads/admitcards/${fileName}`;

  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
  });

  const stream = fs.createWriteStream(filePath);

  doc.pipe(stream);

  // HEADER

  doc
    .fontSize(20)
    .fillColor("#0f172a")
    .text(
      "BIHAR STATE MISSION DEVELOPMENT ORGANIZATION",
      {
        align: "center",
      }
    );

  doc.moveDown(0.3);

  doc
    .fontSize(16)
    .fillColor("#1d4ed8")
    .text(
      "Recruitment Examination Admit Card",
      {
        align: "center",
      }
    );

  doc.moveDown(2);

  // CANDIDATE INFO

  doc
    .fontSize(12)
    .fillColor("black");

  const lines = [

    ["Candidate Name", data.name],

    ["Application No", data.applicationNo],

    ["Roll Number", data.rollNo],

    ["Recruitment", data.recruitmentTitle],

    ["Post Name", data.postName],

    ["Exam Center", data.examCenter],

    ["Exam Date", data.examDate],

    ["Shift", data.shift],

  ];

  for (const [label, value] of lines) {

    doc
      .font("Helvetica-Bold")
      .text(`${label}: `, {
        continued: true,
      });

    doc
      .font("Helvetica")
      .text(String(value));

    doc.moveDown(0.7);

  }

  // QR CODE

  const qrData = JSON.stringify({
    applicationNo: data.applicationNo,
    rollNo: data.rollNo,
  });

  const qrImage = await QRCode.toDataURL(qrData);

  const base64 = qrImage.replace(
    /^data:image\/png;base64,/,
    ""
  );

  const qrBuffer = Buffer.from(base64, "base64");

  doc.image(qrBuffer, 420, 170, {
    width: 120,
  });

  // INSTRUCTIONS

  doc.moveDown(3);

  doc
    .fontSize(14)
    .fillColor("#dc2626")
    .font("Helvetica-Bold")
    .text("Important Instructions");

  doc.moveDown(1);

  const instructions = [

    "Carry this admit card to examination center.",

    "Bring valid photo ID proof.",

    "Reach exam center 30 minutes before exam.",

    "Electronic gadgets are not allowed.",

  ];

  instructions.forEach((i) => {

    doc
      .fontSize(11)
      .fillColor("black")
      .font("Helvetica")
      .text(`• ${i}`);

    doc.moveDown(0.5);

  });

  // FOOTER

  doc.moveDown(4);

  doc
    .fontSize(11)
    .text(
      "Authorized Signature",
      400,
      700
    );

  doc.end();

  return new Promise((resolve, reject) => {

    stream.on("finish", () => {

      resolve(pdfUrl);

    });

    stream.on("error", reject);

  });

}