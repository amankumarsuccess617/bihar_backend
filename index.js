import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { initRedis, cacheMiddleware } from "./lib/cache.js";

import authRoutes from "./routes/authRoutes.js";
import noticeRoutes from "./routes/noticeRoutes.js";
import recruitmentRoutes from "./routes/recruitmentRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import refundRoutes from "./routes/refundRoutes.js"; // ✅ added
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
import formRoutes from "./routes/formRoutes.js"
import { updateAllRecruitmentsExpiry } from "./lib/recruitmentUtils.js";
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://bihar-frontend-kpx2.vercel.app",
    "https://bihar-frontend-kpx2-jnxbnnd3e.vercel.app"
  ],
  credentials: true
}));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Cache middleware for frequently accessed endpoints
// 5-minute cache for public endpoints
app.use("/api/notices", cacheMiddleware(300));
// app.use("/api/recruitments", cacheMiddleware(300));
// app.use("/api/posts", cacheMiddleware(300));
app.use("/api/results", cacheMiddleware(600)); // 10-minute cache

app.use("/api/otp", otpRoutes); // OTP routes should be before auth routes
app.use("/api/auth", authRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/recruitments", recruitmentRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/refunds", refundRoutes); // ✅ added
app.use("/api/admit-cards", admitCardRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/pdfs", pdfRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/reports", reportRoutes); // NOTE: tumhare comments se order mismatch hai, functional issue nahi (unless route conflicts)
app.use("/api/admin", adminRoutes); // NOTE: same as above
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

// Initialize Redis and start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  // Initialize Redis caching (optional)

  // AUTO UPDATE RECRUITMENT STATUS
setInterval(async () => {
  try {
    console.log("Checking recruitment expiry...");

    await updateAllRecruitmentsExpiry();

    console.log("Recruitment expiry updated");
  } catch (err) {
    console.error("Recruitment expiry cron failed", err);
  }
}, 5 * 60 * 1000);

  await initRedis();

  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 API: http://localhost:${PORT}/api`);
  });
}

startServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});