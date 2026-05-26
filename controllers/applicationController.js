import prisma from "../lib/prisma.js";
import { notifyApplicationSubmitted } from "../lib/notificationManager.js";
import { isRecruitmentAccepting } from "../lib/recruitmentUtils.js";

// ==============================
// GENERATE APPLICATION NUMBER
// ==============================
function makeApplicationNo() {

  const d = new Date();

  // Example:
  // APP-20260516-123456

  const y = d.getFullYear();

  const m = String(
    d.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    d.getDate()
  ).padStart(2, "0");

  const rand = String(
    Math.floor(
      100000 + Math.random() * 900000
    )
  );

  return `APP-${y}${m}${day}-${rand}`;
}

// ==============================
// CREATE DRAFT APPLICATION
// ==============================
export const createDraftApplication = async (req, res) => {
  try {

    const { postId } = req.body;

    if (!postId) {
      return res.status(400).json({
        message: "postId required",
      });
    }

    const post = await prisma.post.findUnique({
      where: {
        id: Number(postId),
      },

      include: {
        recruitment: true,
      },
    });

    // Post disabled
    if (
      !post ||
      !post.isActive ||
      !post.recruitment.isActive
    ) {
      return res.status(400).json({
        message: "Post not available",
      });
    }

    // Recruitment expired / not started
    if (
      !isRecruitmentAccepting(
        post.recruitment
      )
    ) {
      return res.status(400).json({
        message:
          "This recruitment is no longer accepting applications",

        status:
          post.recruitment.isExpired
            ? "EXPIRED"
            : "NOT_STARTED",
      });
    }

    // Prevent duplicate applications
    const existing =
      await prisma.application.findFirst({
        where: {
          userId: req.user.id,
          postId: Number(postId),
        },
      });

    if (existing) {
      return res.json(existing);
    }

    const application =
      await prisma.application.create({
        data: {

          applicationNo:
            makeApplicationNo(),

          userId: req.user.id,

          postId: Number(postId),

          status: "DRAFT",

          data: {},

          documents: [],
        },
      });

    res.json(application);

  } catch (error) {

    console.error(
      "[Create Draft Application]",
      error
    );

    res.status(500).json({
      message:
        "Failed to create application",
    });
  }
};

// ==============================
// UPDATE APPLICATION
// ==============================
export const updateApplication = async (req, res) => {
  try {

    const id = Number(req.params.id);

    const {
      data,
      documents,
    } = req.body;

    const app =
      await prisma.application.findFirst({
        where: {
          id,
          userId: req.user.id,
        },
      });

    if (!app) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    // Editable only before successful payment
    if (
      ![
        "DRAFT",
        "PAYMENT_PENDING",
        "PAYMENT_FAILED",
      ].includes(app.status)
    ) {
      return res.status(400).json({
        message:
          "Application not editable",
      });
    }

    const updated =
      await prisma.application.update({
        where: { id },

        data: {

          ...(data !== undefined
            ? { data: data ?? {} }
            : {}),

          ...(documents !== undefined
            ? {
                documents:
                  documents ?? [],
              }
            : {}),
        },
      });

    res.json(updated);

  } catch (error) {

    console.error(
      "[Update Application]",
      error
    );

    res.status(500).json({
      message:
        "Failed to update application",
    });
  }
};

// ==============================
// SUBMIT APPLICATION
// ==============================
export const submitApplication = async (req, res) => {
  try {

    const id = Number(req.params.id);

    const app =
      await prisma.application.findFirst({
        where: {
          id,
          userId: req.user.id,
        },

        include: {
          post: {
            include: {
              recruitment: true,
            },
          },
        },
      });

    if (!app) {
      return res.status(404).json({
        message: "Application not found",
      });
    }

    // Only draft applications can proceed
    if (app.status !== "DRAFT") {
      return res.status(400).json({
        message:
          "Application already submitted",
      });
    }

    // Recruitment expired / disabled
    if (
      !isRecruitmentAccepting(
        app.post.recruitment
      )
    ) {
      return res.status(400).json({

        message:
          app.post.recruitment.isExpired
            ? "Application deadline has passed"
            : "This recruitment is no longer accepting applications",

        status:
          app.post.recruitment.isExpired
            ? "EXPIRED"
            : "NOT_STARTED",
      });
    }

    // Move to payment
    const updated =
      await prisma.application.update({
        where: { id },

        data: {
          status:
            "PAYMENT_PENDING",
        },
      });

    res.json({
      ok: true,

      message:
        "Proceed to payment",

      application: updated,
    });

  } catch (error) {

    console.error(
      "[Submit Application]",
      error
    );

    res.status(500).json({
      message:
        "Failed to submit application",
    });
  }
};

// ==============================
// MY APPLICATIONS
// ==============================
export const myApplications = async (req, res) => {
  try {

    const items =
      await prisma.application.findMany({
        where: {
          userId: req.user.id,
        },

        orderBy: {
          createdAt: "desc",
        },

        include: {

          post: {
            include: {
              recruitment: true,
            },
          },

          payments: {
            orderBy: {
              id: "desc",
            },

            take: 5,
          },

          admitCard: true,

          result: true,
        },
      });

    res.json(items);

  } catch (error) {

    console.error(
      "[My Applications]",
      error
    );

    res.status(500).json({
      message:
        "Failed to fetch applications",
    });
  }
};

// ==============================
// ADMIN LIST APPLICATIONS
// ==============================
export const adminListApplications = async (req, res) => {
  try {

    const {
      status,
      postId,
      recruitmentId,
      userId,
    } = req.query;

    const items =
      await prisma.application.findMany({

        where: {

          ...(status
            ? {
                status:
                  String(status),
              }
            : {}),

          ...(postId
            ? {
                postId:
                  Number(postId),
              }
            : {}),

          ...(userId
            ? {
                userId:
                  Number(userId),
              }
            : {}),

          ...(recruitmentId
            ? {
                post: {
                  recruitmentId:
                    Number(
                      recruitmentId
                    ),
                },
              }
            : {}),
        },

        orderBy: {
          createdAt: "desc",
        },

        include: {

          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },

          post: {
            include: {
              recruitment: true,
            },
          },

          payments: {
            orderBy: {
              id: "desc",
            },

            take: 1,
          },
        },

        take: 200,
      });

    res.json(items);

  } catch (error) {

    console.error(
      "[Admin List Applications]",
      error
    );

    res.status(500).json({
      message:
        "Failed to fetch applications",
    });
  }
};