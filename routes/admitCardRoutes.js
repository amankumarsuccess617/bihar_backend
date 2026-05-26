import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { generateAdmitCardsForPost, myAdmitCards, getAdmitCardsForPost } from "../controllers/admitCardController.js";

const router = express.Router();

// candidate
router.get("/me", authMiddleware, myAdmitCards);

// admin
router.get(
  "/post/:postId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  getAdmitCardsForPost
);

router.post(
  "/generate/post/:postId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  generateAdmitCardsForPost
);

export default router;