import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { bulkZipAdmitCards } from "../controllers/admitCardBulkController.js";

const router = express.Router();

router.get(
  "/zip/post/:postId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  bulkZipAdmitCards
);

export default router;