import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

/* =========================================================
   GENERATE RESULT PDF
========================================================= */

export async function generateResultPdf(data) {

  try {

    /* -------------------------------------
       CREATE DIRECTORY
    ------------------------------------- */

    const uploadsDir = path.join(
      process.cwd(),
      "uploads",
      "results"
    );

    if (!fs.existsSync(uploadsDir)) {

      fs.mkdirSync(uploadsDir, {
        recursive: true,
      });

    }

    /* -------------------------------------
       FILE INFO
    ------------------------------------- */

    const fileName =
      `${data.rollNo}.pdf`;

    const filePath = path.join(
      uploadsDir,
      fileName
    );

    const pdfUrl =
      `/uploads/results/${fileName}`;

    /* -------------------------------------
       PDF INIT
    ------------------------------------- */

    const doc = new PDFDocument({

      size: "A4",

      margin: 40,

    });

    const stream =
      fs.createWriteStream(filePath);

    doc.pipe(stream);

    /* =========================================================
       HEADER
    ========================================================= */

    doc
      .fontSize(22)
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .text(
        "BIHAR STATE MISSION DEVELOPMENT ORGANIZATION",
        {
          align: "center",
        }
      );

    doc.moveDown(0.4);

    doc
      .fontSize(16)
      .fillColor("#1d4ed8")
      .text(
        "Recruitment Examination Result",
        {
          align: "center",
        }
      );

    /* =========================================================
       LINE
    ========================================================= */

    doc.moveDown(1);

    doc
      .moveTo(40, 120)
      .lineTo(555, 120)
      .strokeColor("#cbd5e1")
      .stroke();

    /* =========================================================
       RESULT STATUS BADGE
    ========================================================= */

    doc.moveDown(2);

    const qualified =
      data.status === "QUALIFIED";

    doc
      .roundedRect(40, 145, 150, 35, 8)
      .fill(
        qualified
          ? "#dcfce7"
          : "#fee2e2"
      );

    doc
      .fillColor(
        qualified
          ? "#166534"
          : "#991b1b"
      )
      .fontSize(15)
      .font("Helvetica-Bold")
      .text(
        qualified
          ? "QUALIFIED"
          : "NOT QUALIFIED",
        70,
        156
      );

    /* =========================================================
       CANDIDATE DETAILS
    ========================================================= */

    doc.moveDown(4);

    doc
      .fillColor("black")
      .fontSize(12);

    const details = [

      [
        "Candidate Name",
        data.candidateName,
      ],

      [
        "Roll Number",
        data.rollNo,
      ],

      [
        "Application Number",
        data.applicationNo,
      ],

      [
        "Recruitment",
        data.recruitmentTitle,
      ],

      [
        "Post Name",
        data.postName,
      ],

      [
        "Total Marks",
        data.totalMarks ?? "-",
      ],

      [
        "Overall Rank",
        data.rank ?? "-",
      ],

      [
        "Category Rank",
        data.categoryRank ?? "-",
      ],

      [
        "Published Date",
        data.publishedDate,
      ],

    ];

    for (const [label, value] of details) {

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

    /* =========================================================
       SCORE BOX
    ========================================================= */

    doc.roundedRect(
      40,
      430,
      220,
      90,
      10
    )
    .fill("#eff6ff");

    doc
      .fillColor("#1e3a8a")
      .fontSize(13)
      .font("Helvetica-Bold")
      .text(
        "Total Score",
        60,
        450
      );

    doc
      .fontSize(34)
      .text(
        String(data.totalMarks ?? "-"),
        60,
        470
      );

    /* =========================================================
       QR CODE
    ========================================================= */

    const qrData = JSON.stringify({

      rollNo:
        data.rollNo,

      applicationNo:
        data.applicationNo,

      resultStatus:
        data.status,

    });

    const qrImage =
      await QRCode.toDataURL(qrData);

    const base64 =
      qrImage.replace(
        /^data:image\/png;base64,/,
        ""
      );

    const qrBuffer =
      Buffer.from(
        base64,
        "base64"
      );

    doc.image(
      qrBuffer,
      400,
      420,
      {
        width: 120,
      }
    );

    doc
      .fontSize(9)
      .fillColor("#64748b")
      .text(
        "Scan to verify result",
        410,
        550
      );

    /* =========================================================
       IMPORTANT NOTE
    ========================================================= */

    doc.moveDown(8);

    doc
      .fontSize(13)
      .fillColor("#dc2626")
      .font("Helvetica-Bold")
      .text(
        "Important Instructions"
      );

    doc.moveDown(0.8);

    const instructions = [

      "This is a computer generated result.",

      "Verify all details carefully.",

      "Keep this result PDF safe for future reference.",

      "Final selection subject to document verification.",

    ];

    instructions.forEach((item) => {

      doc
        .fontSize(11)
        .fillColor("black")
        .font("Helvetica")
        .text(`• ${item}`);

      doc.moveDown(0.5);

    });

    /* =========================================================
       FOOTER
    ========================================================= */

    doc
      .fontSize(10)
      .fillColor("#64748b")
      .text(
        "Generated by Bihar Recruitment & Examination Portal",
        40,
        760,
        {
          align: "center",
        }
      );

    /* =========================================================
       END PDF
    ========================================================= */

    doc.end();

    return new Promise((resolve, reject) => {

      stream.on(
        "finish",
        () => {

          resolve(pdfUrl);

        }
      );

      stream.on(
        "error",
        reject
      );

    });

  } catch (err) {

    console.error(
      "[Generate Result PDF Error]",
      err
    );

    throw err;

  }

}