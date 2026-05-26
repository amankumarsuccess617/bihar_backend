import prisma from "../lib/prisma.js";
import { notifyResultPublished } from "../lib/notificationManager.js";

// Admin: upload results in bulk (JSON array)
export const bulkUploadResults = async (req, res) => {
  const { postId, publishedAt, results } = req.body;

  if (!postId || !Array.isArray(results)) {
    return res.status(400).json({ message: "postId and results[] required" });
  }

  const publishTime = publishedAt ? new Date(publishedAt) : new Date();

  let upserted = 0;
  let failed = 0;

  for (const r of results) {
    try {
      // You can match by rollNo OR applicationNo
      const rollNo = r.rollNo ? String(r.rollNo) : null;
      const applicationNo = r.applicationNo ? String(r.applicationNo) : null;

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

      if (!application || application.postId !== Number(postId)) {
        failed++;
        continue;
      }

      await prisma.result.upsert({
        where: { applicationId: application.id },
        update: {
          status: r.status || "NOT_QUALIFIED",
          totalMarks: r.totalMarks ?? null,
          breakdown: r.breakdown ?? null,
          rank: r.rank ?? null,
          categoryRank: r.categoryRank ?? null,
          pdfUrl: r.pdfUrl ?? null,
          publishedAt: publishTime,
        },
        create: {
          applicationId: application.id,
          status: r.status || "NOT_QUALIFIED",
          totalMarks: r.totalMarks ?? null,
          breakdown: r.breakdown ?? null,
          rank: r.rank ?? null,
          categoryRank: r.categoryRank ?? null,
          pdfUrl: r.pdfUrl ?? null,
          publishedAt: publishTime,
        },
      });

      upserted++;
    } catch (e) {
      failed++;
    }
  }

  res.json({ postId: Number(postId), upserted, failed });
};

// Public: search result by roll number
export const publicResultByRollNo = async (req, res) => {
  const { rollNo } = req.params;

  const admit = await prisma.admitCard.findUnique({
    where: { rollNo: String(rollNo) },
    include: {
      application: {
        include: {
          post: { include: { recruitment: true } },
          result: true,
          user: { select: { name: true } }, // public: do NOT expose email/phone
        },
      },
    },
  });

  if (!admit || !admit.application?.result) {
    return res.status(404).json({ message: "Result not found" });
  }

  const a = admit.application;

  res.json({
    rollNo: admit.rollNo,
    candidateName: a.user.name,
    recruitment: { code: a.post.recruitment.code, title: a.post.recruitment.title },
    post: { code: a.post.code, name: a.post.name },
    result: a.result,
  });
};

// Public: merit list (top N) for a post
export const publicMeritList = async (req, res) => {
  const postId = Number(req.params.postId);
  const limit = Math.min(Number(req.query.limit || 100), 500);

  const items = await prisma.result.findMany({
    where: {
      application: { postId },
      status: { in: ["QUALIFIED"] },
    },
    orderBy: [
      { totalMarks: "desc" },
      { rank: "asc" },
      { id: "asc" },
    ],
    take: limit,
    include: {
      application: {
        include: {
          admitCard: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  res.json(
    items.map((r) => ({
      rollNo: r.application.admitCard?.rollNo || null,
      candidateName: r.application.user.name,
      totalMarks: r.totalMarks,
      rank: r.rank,
      categoryRank: r.categoryRank,
    }))
  );
};

// Candidate: my results
export const myResults = async (req, res) => {
  const apps = await prisma.application.findMany({
    where: { userId: req.user.id },
    include: {
      post: { include: { recruitment: true } },
      admitCard: true,
      result: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const out = apps
    .filter((a) => a.result)
    .map((a) => ({
      applicationId: a.id,
      applicationNo: a.applicationNo,
      rollNo: a.admitCard?.rollNo || null,
      recruitment: { code: a.post.recruitment.code, title: a.post.recruitment.title },
      post: { id: a.post.id, code: a.post.code, name: a.post.name },
      result: a.result,
    }));

  res.json(out);
};

// Admin: publish results for a post (send notifications)
export const publishResults = async (req, res) => {
  const postId = Number(req.params.postId);

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { recruitment: true },
  });

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  // Get all results for this post to verify they exist
  const results = await prisma.result.findMany({
    where: { application: { postId } },
  });

  if (results.length === 0) {
    return res.status(400).json({ message: "No results to publish" });
  }

  // Send notifications to all candidates (handled by notifyResultPublished)
  try {
    await notifyResultPublished(post).catch((err) =>
      console.error("[Publish Result Error]", err)
    );

    res.json({
      postId,
      totalResults: results.length,
      message: "Results published and notifications sent to all applicants",
    });
  } catch (err) {
    console.error("[Publish Error]", err);
    res.status(500).json({ message: "Error publishing results" });
  }
};