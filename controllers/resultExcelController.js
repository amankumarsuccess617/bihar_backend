import prisma from "../lib/prisma.js";
import * as XLSX from "xlsx";

function getCell(row, key) {
  // key can be exact header: "rollNo" / "applicationNo" etc.
  const v = row[key];
  return v === undefined || v === null ? "" : String(v).trim();
}

export const bulkUploadResultsExcel = async (req, res) => {
  const postId = Number(req.body.postId);
  const publishedAt = req.body.publishedAt ? new Date(req.body.publishedAt) : new Date();

  if (!postId) return res.status(400).json({ message: "postId required" });
  if (!req.file) return res.status(400).json({ message: "excel file required (field name: file)" });

  const wb = XLSX.read(req.file.buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // rows as objects using header row
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

  let upserted = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const rollNo = getCell(row, "rollNo");
      const applicationNo = getCell(row, "applicationNo");

      const status = getCell(row, "status") || "NOT_QUALIFIED";
      const totalMarksRaw = getCell(row, "totalMarks");
      const rankRaw = getCell(row, "rank");
      const categoryRankRaw = getCell(row, "categoryRank");
      const pdfUrl = getCell(row, "pdfUrl");

      const totalMarks = totalMarksRaw ? Number(totalMarksRaw) : null;
      const rank = rankRaw ? Number(rankRaw) : null;
      const categoryRank = categoryRankRaw ? Number(categoryRankRaw) : null;

      if (!rollNo && !applicationNo) {
        failed++;
        continue;
      }

      let application = null;

      if (rollNo) {
        const admit = await prisma.admitCard.findUnique({ where: { rollNo } });
        if (admit) application = await prisma.application.findUnique({ where: { id: admit.applicationId } });
      } else {
        application = await prisma.application.findUnique({ where: { applicationNo } });
      }

      if (!application || application.postId !== postId) {
        failed++;
        continue;
      }

      await prisma.result.upsert({
        where: { applicationId: application.id },
        update: {
          status,
          totalMarks,
          breakdown: null, // can be extended later
          rank,
          categoryRank,
          pdfUrl: pdfUrl || null,
          publishedAt,
        },
        create: {
          applicationId: application.id,
          status,
          totalMarks,
          breakdown: null,
          rank,
          categoryRank,
          pdfUrl: pdfUrl || null,
          publishedAt,
        },
      });

      upserted++;
    } catch (e) {
      failed++;
    }
  }

  res.json({
    postId,
    sheet: sheetName,
    rows: rows.length,
    upserted,
    failed,
    requiredHeaders: ["rollNo OR applicationNo", "status", "totalMarks", "rank", "categoryRank", "pdfUrl"],
  });
};