import prisma from "../lib/prisma.js";
import { notifyApplicationSubmitted } from "../lib/notificationManager.js";
import { isRecruitmentAccepting } from "../lib/recruitmentUtils.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";

function makeApplicationNo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = String(Math.floor(100000 + Math.random() * 900000));
  return `APP-${y}${m}${day}-${rand}`;
}

export const createDraftApplication = async (req, res, next) => {
  try {
    const { postId } = req.body;

    if (!postId) {
      throw new AppError("postId required", 400);
    }

    const post = await prisma.post.findUnique({
      where: { id: Number(postId) },
      include: { recruitment: true },
    });

    if (!post || !post.isActive || !post.recruitment.isActive) {
      throw new AppError("Post not available", 400);
    }

    if (!isRecruitmentAccepting(post.recruitment)) {
      throw new AppError(
        "This recruitment is no longer accepting applications",
        400,
        {
          status: post.recruitment.isExpired ? "EXPIRED" : "NOT_STARTED",
        }
      );
    }

    const existing = await prisma.application.findFirst({
      where: {
        userId: req.user.id,
        postId: Number(postId),
      },
    });

    if (existing) {
      return res.json(existing);
    }

    const application = await prisma.application.create({
      data: {
        applicationNo: makeApplicationNo(),
        userId: req.user.id,
        postId: Number(postId),
        status: "DRAFT",
        data: {},
        documents: [],
      },
    });

    res.json(application);
  } catch (error) {
    logger.error("create_draft_application_failed", { message: error.message });
    next(
      error instanceof AppError
        ? error
        : new AppError("Failed to create application", 500)
    );
  }
};

export const updateApplication = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { data, documents } = req.body;

    const app = await prisma.application.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!app) {
      throw new AppError("Application not found", 404);
    }

    if (!["DRAFT", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(app.status)) {
      throw new AppError("Application not editable", 400);
    }

    const updated = await prisma.application.update({
      where: { id },
      data: {
        ...(data !== undefined ? { data: data ?? {} } : {}),
        ...(documents !== undefined ? { documents: documents ?? [] } : {}),
      },
    });

    res.json(updated);
  } catch (error) {
    logger.error("update_application_failed", { message: error.message });
    next(
      error instanceof AppError
        ? error
        : new AppError("Failed to update application", 500)
    );
  }
};

export const submitApplication = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const app = await prisma.application.findFirst({
      where: { id, userId: req.user.id },
      include: {
        post: {
          include: { recruitment: true },
        },
      },
    });

    if (!app) {
      throw new AppError("Application not found", 404);
    }

    if (app.status !== "DRAFT") {
      throw new AppError("Application already submitted", 400);
    }

    if (!isRecruitmentAccepting(app.post.recruitment)) {
      throw new AppError(
        app.post.recruitment.isExpired
          ? "Application deadline has passed"
          : "This recruitment is no longer accepting applications",
        400,
        {
          status: app.post.recruitment.isExpired ? "EXPIRED" : "NOT_STARTED",
        }
      );
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { status: "PAYMENT_PENDING" },
    });

    if (typeof notifyApplicationSubmitted === "function") {
      try {
        await notifyApplicationSubmitted(updated, req.user, app.post);
      } catch (err) {
        logger.error("application_submit_notification_failed", {
          message: err.message,
        });
      }
    }

    res.json({
      ok: true,
      message: "Proceed to payment",
      application: updated,
    });
  } catch (error) {
    logger.error("submit_application_failed", { message: error.message });
    next(
      error instanceof AppError
        ? error
        : new AppError("Failed to submit application", 500)
    );
  }
};

export const myApplications = async (req, res, next) => {
  try {
    const items = await prisma.application.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        post: {
          include: { recruitment: true },
        },
        payments: {
          orderBy: { id: "desc" },
          take: 5,
        },
        admitCard: true,
        result: true,
      },
    });

    res.json(items);
  } catch (error) {
    logger.error("my_applications_failed", { message: error.message });
    next(new AppError("Failed to fetch applications", 500));
  }
};

export const adminListApplications = async (req, res, next) => {
  try {
    const { status, postId, recruitmentId, userId } = req.query;

    const where = {};
    if (status) where.status = String(status);
    if (postId) where.postId = Number(postId);
    if (userId) where.userId = Number(userId);
    if (recruitmentId) {
      where.post = { recruitmentId: Number(recruitmentId) };
    }

    const items = await prisma.application.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        post: {
          include: { recruitment: true },
        },
        payments: {
          orderBy: { id: "desc" },
          take: 1,
        },
      },
    });

    res.json(items);
  } catch (error) {
    logger.error("admin_list_applications_failed", { message: error.message });
    next(new AppError("Failed to fetch applications", 500));
  }
};
