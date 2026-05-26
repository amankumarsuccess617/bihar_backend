import express from "express";
import multer from "multer";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { bulkUploadResultsExcel } from "../controllers/resultExcelController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

router.post(
  "/bulk-upload-excel",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  upload.single("file"),
  bulkUploadResultsExcel
);

export default router;