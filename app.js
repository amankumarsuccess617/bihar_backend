import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { cacheMiddleware } from "./lib/cache.js";
import { errorMiddleware, notFoundHandler } from "./lib/errors.js";
import { logger } from "./lib/logger.js";

import authRoutes from "./routes/authRoutes.js";
import noticeRoutes from "./routes/noticeRoutes.js";
import recruitmentRoutes from "./routes/recruitmentRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import refundRoutes from "./routes/refundRoutes.js";
import admitCardRoutes from "./routes/admitCardRoutes.js";
import resultRoutes from "./routes/resultRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";
import pdfRoutes from "./routes/pdfRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import admitCardBulkRoutes from "./routes/admitCardBulkRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import resultExcelRoutes from "./routes/resultExcelRoutes.js";
import financeRoutes from "./routes/financeRoutes.js";
import pageRoutes from "./routes/pageRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import logRoutes from "./routes/logRoutes.js";
import formRoutes from "./routes/formRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: [
        "http://localhost:3000",
        "https://bihar-frontend-kpx2.vercel.app",
        "https://bihar-frontend-kpx2-jnxbnnd3e.vercel.app",
      ],
      credentials: true,
    })
  );
  app.use(express.json());
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

  app.use("/api/notices", cacheMiddleware(300));
  app.use("/api/results", cacheMiddleware(600));

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      service: "bihar-backend",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/metrics", (req, res) => {
    const mem = process.memoryUsage();
    res.status(200).json({
      uptimeSeconds: process.uptime(),
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
      },
      nodeVersion: process.version,
    });
  });

  app.use("/api/otp", otpRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/notices", noticeRoutes);
  app.use("/api/recruitments", recruitmentRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/applications", applicationRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/refunds", refundRoutes);
  app.use("/api/admit-cards", admitCardRoutes);
  app.use("/api/results", resultRoutes);
  app.use("/api/pdfs", pdfRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/invoices", invoiceRoutes);
  app.use("/api/admit-cards", admitCardBulkRoutes);
  app.use("/api/results/excel", resultExcelRoutes);
  app.use("/api/finance", financeRoutes);
  app.use("/api/pages", pageRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/logs", logRoutes);
  app.use("/api/forms", formRoutes);

  app.get("/", (req, res) => {
    res.send("Server running ");
  });

  app.use(notFoundHandler);
  app.use((err, req, res, next) => {
    logger.error("request_failed", {
      path: req.originalUrl,
      method: req.method,
      statusCode: err.statusCode || 500,
      message: err.message,
    });
    return errorMiddleware(err, req, res, next);
  });

  return app;
}

export default createApp;
