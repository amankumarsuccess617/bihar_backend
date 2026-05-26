import express from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";

const router = express.Router();

// get form
router.get("/:postId", async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.postId) },
  });
  res.json(post?.formSchema || {});
});

// update form
router.put(
  "/:postId",
  authMiddleware,
  roleMiddleware("ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    const { schema } = req.body;

    const updated = await prisma.post.update({
      where: { id: Number(req.params.postId) },
      data: { formSchema: schema },
    });

    res.json(updated);
  }
);

export default router;