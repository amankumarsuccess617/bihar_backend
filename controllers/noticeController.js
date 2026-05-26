import prisma from "../lib/prisma.js";
import { notifyNoticePosted } from "../lib/notificationManager.js";

// Public: list published notices
export const listNotices = async (req, res) => {
  const { category, department } = req.query;

  const notices = await prisma.notice.findMany({
    where: {
      status: "PUBLISHED",
      ...(category ? { category: String(category) } : {}),
      ...(department ? { department: String(department) } : {}),
    },
    orderBy: [{ isImportant: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  res.json(notices);
};

// Admin: create draft notice
export const createNotice = async (req, res) => {
  const { title, body, category, department, isImportant, publishAt, attachments } = req.body;

  if (!title) return res.status(400).json({ message: "title required" });

  const notice = await prisma.notice.create({
    data: {
      title,
      body: body || null,
      category: category || null,
      department: department || null,
      isImportant: Boolean(isImportant),
      publishAt: publishAt ? new Date(publishAt) : null,
      attachments: attachments ?? null,
      createdById: req.user.id,
      status: "DRAFT",
    },
  });

  res.json(notice);
};

// Admin: publish now
export const publishNoticeNow = async (req, res) => {
  const id = Number(req.params.id);

  const notice = await prisma.notice.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  // Send notification to all users
  await notifyNoticePosted(notice).catch((err) =>
    console.error("[Notice Notification Error]", err)
  );

  res.json(notice);
};