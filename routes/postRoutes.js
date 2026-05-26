// backend/routes/postRoutes.js

import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";

import {
  listAllPosts,
  listPostsByRecruitment,
  listPostsByRecruitmentId,
  createPost,
  updatePost,
  deletePost,
  getPostById,
  togglePostStatus,
} from "../controllers/postController.js";

const router = express.Router();

// ======================================================
// ADMIN: LIST ALL POSTS
// ======================================================

router.get(
  "/",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  listAllPosts
);

// ======================================================
// TEST ROUTE
// ======================================================

router.get("/test", (req, res) => {
  res.json({
    message: "Posts route is working!",
    timestamp: new Date(),
  });
});

// ======================================================
// PUBLIC: POSTS BY RECRUITMENT CODE (MUST BE BEFORE /:id)
// ======================================================

router.get(
  "/by-recruitment/:code",
  listPostsByRecruitment
);

// ======================================================
// PUBLIC/ADMIN: POSTS BY RECRUITMENT ID
// ======================================================

router.get(
  "/recruitment/:recruitmentId",
  listPostsByRecruitmentId
);

// ======================================================
// GET SINGLE POST BY ID (MUST BE LAST)
// ======================================================

router.get("/:id", getPostById);

// ======================================================
// ADMIN: CREATE POST
// ======================================================

router.post(
  "/recruitment/:recruitmentId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  createPost
);

// ======================================================
// ADMIN: UPDATE POST
// ======================================================

router.patch(
  "/:id",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  updatePost
);

router.patch(
  "/:id/toggle",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  togglePostStatus
);

// ======================================================
// ADMIN: DELETE POST
// ======================================================

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  deletePost
);

export default router;