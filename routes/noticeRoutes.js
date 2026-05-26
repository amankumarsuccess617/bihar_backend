import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { listNotices, createNotice, publishNoticeNow } from "../controllers/noticeController.js";

const router = express.Router();

router.get("/", listNotices);

router.post(
  "/",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  createNotice
);

router.post(
  "/:id/publish",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  publishNoticeNow
);

export default router;