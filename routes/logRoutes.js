import express from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.get(
  "/login",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    const logs = await prisma.loginAttempt.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(logs);
  }
);

export default router;