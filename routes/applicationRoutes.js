import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import {
  createDraftApplication,
  updateApplication,
  submitApplication,
  myApplications,
  adminListApplications,
} from "../controllers/applicationController.js";

const router = express.Router();

// candidate (must be logged in)
router.post("/draft", authMiddleware, createDraftApplication);
router.patch("/:id", authMiddleware, updateApplication);
router.post("/:id/submit", authMiddleware, submitApplication);
router.get("/me", authMiddleware, myApplications);

// admin
router.get(
  "/admin",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  adminListApplications
);

export default router;