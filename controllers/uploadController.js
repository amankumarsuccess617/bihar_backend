import prisma from "../lib/prisma.js";

export const attachDocumentToApplication = async (req, res) => {
  const applicationId = Number(req.params.applicationId);
  const { type } = req.body; // "photo" | "signature" | "certificate"
  const file = req.file;

  if (!file) return res.status(400).json({ message: "file required" });
  if (!type) return res.status(400).json({ message: "type required" });

  const app = await prisma.application.findFirst({
    where: { id: applicationId, userId: req.user.id },
  });
  if (!app) return res.status(404).json({ message: "Application not found" });

  const url = `/uploads/${file.destination.split("uploads").pop().replace(/\\/g, "/")}/${file.filename}`
    .replace("//", "/");

  const currentDocs = Array.isArray(app.documents) ? app.documents : [];
  const nextDocs = [...currentDocs, { type, url, originalName: file.originalname, size: file.size }];

  const updated = await prisma.application.update({
    where: { id: app.id },
    data: { documents: nextDocs },
  });

  res.json(updated);
};