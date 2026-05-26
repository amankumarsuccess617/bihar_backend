import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import {
  getPublishedPageBySlug,
  listPublishedPages,
  adminUpsertPage,
  adminListPages,
} from "../controllers/pageController.js";

const router = express.Router();

// public
router.get("/public/list", listPublishedPages);
router.get("/public/:slug", getPublishedPageBySlug);

// admin
router.get("/", authMiddleware, roleMiddleware("ADMIN", "SUPER_ADMIN"), adminListPages);
router.post("/", authMiddleware, roleMiddleware("ADMIN", "SUPER_ADMIN"), adminUpsertPage);

export default router;