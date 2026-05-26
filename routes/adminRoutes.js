import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { dashboardStats } from "../controllers/adminController.js";

const router = express.Router();

router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  dashboardStats
);

export default router;