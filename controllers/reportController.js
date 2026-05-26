import prisma from "../lib/prisma.js";
import { Parser } from "json2csv";

export const exportApplicationsCsv = async (req, res) => {
  const { postId, recruitmentId, status } = req.query;

  const apps = await prisma.application.findMany({
    where: {
      ...(status ? { status: String(status) } : {}),
      ...(postId ? { postId: Number(postId) } : {}),
      ...(recruitmentId
        ? { post: { recruitmentId: Number(recruitmentId) } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      post: { include: { recruitment: true } },
      payments: { orderBy: { id: "desc" }, take: 1 },
      admitCard: true,
      result: true,
    },
    take: 5000,
  });

  const rows = apps.map((a) => ({
    applicationNo: a.applicationNo,
    status: a.status,
    submittedAt: a.submittedAt ? new Date(a.submittedAt).toISOString() : "",
    candidateName: a.user.name,
    email: a.user.email,
    phone: a.user.phone || "",
    recruitmentCode: a.post.recruitment.code,
    recruitmentTitle: a.post.recruitment.title,
    postCode: a.post.code,
    postName: a.post.name,
    lastPaymentStatus: a.payments?.[0]?.status || "",
    lastPaymentAmountPaise: a.payments?.[0]?.amountPaise || "",
    rollNo: a.admitCard?.rollNo || "",
    resultStatus: a.result?.status || "",
    totalMarks: a.result?.totalMarks ?? "",
    rank: a.result?.rank ?? "",
  }));

  const parser = new Parser({ fields: Object.keys(rows[0] || { applicationNo: "" }) });
  const csv = parser.parse(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=applications.csv");
  res.send(csv);
};

export const exportResultsCsv = async (req, res) => {
  const { postId } = req.query;
  if (!postId) return res.status(400).json({ message: "postId required" });

  const results = await prisma.result.findMany({
    where: { application: { postId: Number(postId) } },
    orderBy: [{ totalMarks: "desc" }, { rank: "asc" }],
    include: {
      application: {
        include: {
          user: { select: { name: true, email: true, phone: true } },
          admitCard: true,
          post: { include: { recruitment: true } },
        },
      },
    },
    take: 10000,
  });

  const rows = results.map((r) => ({
    recruitmentCode: r.application.post.recruitment.code,
    postCode: r.application.post.code,
    postName: r.application.post.name,
    applicationNo: r.application.applicationNo,
    rollNo: r.application.admitCard?.rollNo || "",
    candidateName: r.application.user.name,
    email: r.application.user.email,
    phone: r.application.user.phone || "",
    resultStatus: r.status,
    totalMarks: r.totalMarks ?? "",
    rank: r.rank ?? "",
    categoryRank: r.categoryRank ?? "",
    publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : "",
  }));

  const parser = new Parser({ fields: Object.keys(rows[0] || { applicationNo: "" }) });
  const csv = parser.parse(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=results.csv");
  res.send(csv);
};

// ADMIN: GET ALL GENERATED REPORTS
export const getReports = async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    const formatted = reports.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      generatedAt: r.createdAt,
      fileUrl: r.fileUrl,
      recordCount: r.recordCount || 0,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("[Get Reports]", error);
    return res.status(500).json({
      message: "Failed to fetch reports",
      error: error.message,
    });
  }
};

// ADMIN: CREATE/GENERATE NEW REPORT
export const generateReport = async (req, res) => {
  try {
    const { type, recruitmentId, postId, dateFrom, dateTo } = req.body;

    if (!type) {
      return res.status(400).json({ message: "Report type required" });
    }

    // Create report record with PENDING status
    const report = await prisma.report.create({
      data: {
        type,
        status: "PENDING",
        recordCount: 0,
      },
    });

    // TODO: Add background job to generate report
    // For now, generate immediately and update status

    try {
      let recordCount = 0;
      let fileUrl = null;

      if (type === "applications") {
        const apps = await prisma.application.findMany({
          where: {
            ...(postId ? { postId: Number(postId) } : {}),
            ...(recruitmentId
              ? { post: { recruitmentId: Number(recruitmentId) } }
              : {}),
            ...(dateFrom || dateTo
              ? {
                  createdAt: {
                    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                    ...(dateTo ? { lte: new Date(dateTo) } : {}),
                  },
                }
              : {}),
          },
          include: {
            user: { select: { name: true, email: true, phone: true } },
            post: { include: { recruitment: true } },
            payments: { orderBy: { id: "desc" }, take: 1 },
            admitCard: true,
            result: true,
          },
          take: 5000,
        });

        recordCount = apps.length;

        const rows = apps.map((a) => ({
          applicationNo: a.applicationNo,
          status: a.status,
          submittedAt: a.submittedAt ? new Date(a.submittedAt).toISOString() : "",
          candidateName: a.user.name,
          email: a.user.email,
          phone: a.user.phone || "",
          recruitmentCode: a.post.recruitment.code,
          recruitmentTitle: a.post.recruitment.title,
          postCode: a.post.code,
          postName: a.post.name,
          lastPaymentStatus: a.payments?.[0]?.status || "",
          lastPaymentAmountPaise: a.payments?.[0]?.amountPaise || "",
          rollNo: a.admitCard?.rollNo || "",
          resultStatus: a.result?.status || "",
          totalMarks: a.result?.totalMarks ?? "",
          rank: a.result?.rank ?? "",
        }));

        if (rows.length > 0) {
          const parser = new Parser({ fields: Object.keys(rows[0]) });
          const csv = parser.parse(rows);
          fileUrl = `/reports/applications_${report.id}_${Date.now()}.csv`;
          // In production, save to S3 or file storage
        }
      } else if (type === "results") {
        if (!postId) {
          return res.status(400).json({ message: "postId required for results report" });
        }

        const results = await prisma.result.findMany({
          where: {
            application: { postId: Number(postId) },
            ...(dateFrom || dateTo
              ? {
                  createdAt: {
                    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                    ...(dateTo ? { lte: new Date(dateTo) } : {}),
                  },
                }
              : {}),
          },
          orderBy: [{ totalMarks: "desc" }, { rank: "asc" }],
          include: {
            application: {
              include: {
                user: { select: { name: true, email: true, phone: true } },
                admitCard: true,
                post: { include: { recruitment: true } },
              },
            },
          },
          take: 10000,
        });

        recordCount = results.length;
        fileUrl = `/reports/results_${report.id}_${Date.now()}.csv`;
      } else if (type === "payments") {
        const payments = await prisma.payment.findMany({
          where: {
            ...(postId ? { application: { postId: Number(postId) } } : {}),
            ...(recruitmentId
              ? { application: { post: { recruitmentId: Number(recruitmentId) } } }
              : {}),
            ...(dateFrom || dateTo
              ? {
                  createdAt: {
                    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                    ...(dateTo ? { lte: new Date(dateTo) } : {}),
                  },
                }
              : {}),
          },
        });

        recordCount = payments.length;
        fileUrl = `/reports/payments_${report.id}_${Date.now()}.csv`;
      } else if (type === "refunds") {
        const refunds = await prisma.refund.findMany({
          where: {
            ...(dateFrom || dateTo
              ? {
                  createdAt: {
                    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                    ...(dateTo ? { lte: new Date(dateTo) } : {}),
                  },
                }
              : {}),
          },
        });

        recordCount = refunds.length;
        fileUrl = `/reports/refunds_${report.id}_${Date.now()}.csv`;
      } else if (type === "candidates") {
        const candidates = await prisma.user.findMany({
          where: {
            applications: {
              some: {
                ...(postId ? { postId: Number(postId) } : {}),
                ...(recruitmentId
                  ? { post: { recruitmentId: Number(recruitmentId) } }
                  : {}),
              },
            },
          },
        });

        recordCount = candidates.length;
        fileUrl = `/reports/candidates_${report.id}_${Date.now()}.csv`;
      }

      // Update report status to COMPLETED
      const updated = await prisma.report.update({
        where: { id: report.id },
        data: {
          status: "COMPLETED",
          recordCount,
          fileUrl,
        },
      });

      return res.json({
        message: "Report generated successfully",
        report: updated,
      });
    } catch (generateError) {
      console.error("[Report Generation Error]", generateError);

      // Update report status to FAILED
      await prisma.report.update({
        where: { id: report.id },
        data: {
          status: "FAILED",
        },
      });

      throw generateError;
    }
  } catch (error) {
    console.error("[Generate Report]", error);
    return res.status(500).json({
      message: "Failed to generate report",
      error: error.message,
    });
  }
};