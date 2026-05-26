import prisma from "../lib/prisma.js";
import fs from "fs";
import path from "path";
import archiver from "archiver";

function fileExists(absPath) {
  try {
    return fs.existsSync(absPath);
  } catch {
    return false;
  }
}

// Admin downloads zip of admit card PDFs for a postId
export const bulkZipAdmitCards = async (req, res) => {
  const postId = Number(req.params.postId);
  if (!postId) return res.status(400).json({ message: "Invalid postId" });

  const apps = await prisma.application.findMany({
    where: {
      postId,
      admitCard: { isNot: null },
    },
    include: {
      admitCard: true,
      user: { select: { name: true } },
    },
    orderBy: { id: "asc" },
  });

  const missing = [];

  const files = []; // [{ absPath, nameInZip }]
  for (const a of apps) {
    const roll = a.admitCard.rollNo.replace(/[^\w\-]+/g, "_");

    let pdfAbs = null;
    if (a.admitCard.pdfUrl && a.admitCard.pdfUrl.startsWith("/uploads/")) {
      pdfAbs = path.join(process.cwd(), a.admitCard.pdfUrl.replace(/^\//, ""));
    }

    const ok = pdfAbs && fileExists(pdfAbs);

    files.push({
      absPath: ok ? pdfAbs : null,
      nameInZip: `${roll}.pdf`,
      rollNo: a.admitCard.rollNo,
      applicationNo: a.applicationNo,
      candidateName: a.user?.name || "candidate",
      missingPdf: !ok,
    });

    if (!ok) missing.push({ rollNo: a.admitCard.rollNo, applicationNo: a.applicationNo });
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=admitcards_post_${postId}.zip`
  );

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    res.status(500).end(String(err.message || err));
  });

  archive.pipe(res);

  // optional summary file inside zip (helps admins)
  const summaryLines = [];
  summaryLines.push("rollNo,applicationNo,name,zipFileName,included_pdf");
  for (const f of files) {
    summaryLines.push(
      `${f.rollNo},${f.applicationNo},"${(f.candidateName || "").replace(/"/g, '""')}",${f.nameInZip},${f.absPath ? "YES" : "NO"}`
    );
  }
  archive.append(Buffer.from(summaryLines.join("\n"), "utf8"), { name: "SUMMARY.csv" });

  let addedCount = 0;
  for (const f of files) {
    if (f.absPath) {
      archive.file(f.absPath, { name: f.nameInZip });
      addedCount++;
    }
  }

  archive.append(
    Buffer.from(
      JSON.stringify(
        {
          postId,
          totalApplicationsWithAdmitCard: apps.length,
          pdfFilesAddedToZip: addedCount,
          missingPdfCount: missing.length,
          missingPdfSample: missing.slice(0, 50),
        },
        null,
        2
      ),
      "utf8"
    ),
    { name: "REPORT.json" }
  );

  await archive.finalize();

  // If you prefer JSON response instead of zip, don't use finalize + pipe combo.
};