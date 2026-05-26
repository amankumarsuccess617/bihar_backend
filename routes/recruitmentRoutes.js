import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import {
  listActiveRecruitments,
  listAllRecruitments,
  createRecruitment,
  updateRecruitment,
  toggleRecruitmentStatus,
} from "../controllers/recruitmentController.js";

const router = express.Router();

// public - only active recruitments
router.get("/", listActiveRecruitments);

// admin - all recruitments including expired
router.get("/admin/all", authMiddleware, roleMiddleware("ADMIN", "SUPER_ADMIN"), listAllRecruitments);

// admin
router.post("/", authMiddleware, roleMiddleware("ADMIN", "SUPER_ADMIN"), createRecruitment);
router.patch("/:id", authMiddleware, roleMiddleware("ADMIN", "SUPER_ADMIN"), updateRecruitment);
router.patch("/:id/toggle", authMiddleware, roleMiddleware("ADMIN", "SUPER_ADMIN"), toggleRecruitmentStatus);

export default router;