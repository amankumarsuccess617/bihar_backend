import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import {
  bulkUploadResults,
  publicResultByRollNo,
  publicMeritList,
  myResults,
  publishResults,
} from "../controllers/resultController.js";

const router = express.Router();

// public
router.get("/roll/:rollNo", publicResultByRollNo);
router.get("/merit/post/:postId", publicMeritList);

// candidate
router.get("/me", authMiddleware, myResults);

// admin
router.post(
  "/bulk-upload",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  bulkUploadResults
);

router.post(
  "/publish/:postId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  publishResults
);

export default router;