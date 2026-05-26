import prisma from "../lib/prisma.js";
import { notifyNewPost } from "../lib/notificationManager.js";
import {
  updateRecruitmentExpiry,
  getRecruitmentStatus,
  disableRecruitmentIfNoPostsAsync,
} from "../lib/recruitmentUtils.js";

// Admin: list all posts
export const listAllPosts = async (
  req,
  res
) => {
  const posts =
    await prisma.post.findMany({
      include: {
        recruitment: {
          select: {
            id: true,
            code: true,
            title: true,
          },
        },
      },

      orderBy: {
        id: "desc",
      },
    });

  res.json(posts);
};

// Public/Candidate: posts by recruitment code
export const listPostsByRecruitment =
  async (req, res) => {
    try {
      const { code } =
        req.params;

      const recruitment =
        await prisma.recruitment.findUnique(
          {
            where: {
              code,
            },

            include: {
              posts: {
                where: {
                  isActive: true,
                },

                orderBy: {
                  id: "asc",
                },
              },
            },
          }
        );

      if (!recruitment) {
        return res
          .status(404)
          .json({
            message:
              "Recruitment not found",
          });
      }

      /*
        IMPORTANT FIX
      */

      if (
        recruitment.isActive ===
        false
      ) {
        return res.json({
          ...recruitment,

          posts: [],

          isExpired: true,

          status: {
            status:
              "DISABLED",

            label:
              "Recruitment Disabled",
          },
        });
      }

      // Update recruitment expiry status

      const updated =
        await updateRecruitmentExpiry(
          recruitment.id
        );

      res.json({
        ...recruitment,

        isExpired:
          updated.isExpired,

        isActive:
          updated.isActive,

        status:
          getRecruitmentStatus(
            updated
          ),
      });
    } catch (error) {
      console.error(
        "[List Posts By Recruitment]",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch recruitment",
      });
    }
  };

export const togglePostStatus =
  async (req, res) => {
    try {
      const id = Number(
        req.params.id
      );

      const post =
        await prisma.post.findUnique(
          {
            where: { id },
          }
        );

      if (!post) {
        return res
          .status(404)
          .json({
            message:
              "Post not found",
          });
      }

      const updated =
        await prisma.post.update({
          where: { id },

          data: {
            isActive:
              !post.isActive,
          },
        });

      // Check if recruitment should be disabled
      await disableRecruitmentIfNoPostsAsync(
        post.recruitmentId
      );

      res.json(updated);
    } catch (error) {
      console.error(
        "[Toggle Post]",
        error
      );

      res.status(500).json({
        message:
          "Failed to update post",
      });
    }
  };

// Admin: delete post
export const deletePost =
  async (req, res) => {
    try {
      const id = Number(
        req.params.id
      );

      const post =
        await prisma.post.findUnique(
          {
            where: { id },
          }
        );

      if (!post) {
        return res
          .status(404)
          .json({
            message:
              "Post not found",
          });
      }

      const recruitmentId =
        post.recruitmentId;

      const deleted =
        await prisma.post.delete({
          where: { id },
        });

      // Check if recruitment should be disabled
      await disableRecruitmentIfNoPostsAsync(
        recruitmentId
      );

      res.json({
        message:
          "Post deleted successfully",
        deleted,
      });
    } catch (error) {
      console.error(
        "[Delete Post]",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete post",
      });
    }
  };

// Admin/Public: posts by recruitment ID
export const listPostsByRecruitmentId =
  async (req, res) => {
    try {
      const recruitmentId =
        Number(
          req.params
            .recruitmentId
        );

      const posts =
        await prisma.post.findMany(
          {
            where: {
              recruitmentId,
            },

            include: {
              recruitment: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                },
              },
            },

            orderBy: {
              id: "asc",
            },
          }
        );

      res.json(posts);
    } catch (error) {
      console.error(
        "[List Posts By Recruitment ID]",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch posts",
      });
    }
  };

// Admin: create post under recruitment
export const createPost = async (
  req,
  res
) => {
  try {
    const recruitmentId =
      Number(
        req.params
          .recruitmentId
      );

    const {
      code,
      name,
      vacancies,
      feeRules,
      formSchema,
      isActive,
    } = req.body;

    if (!code || !name) {
      return res
        .status(400)
        .json({
          message:
            "code, name required",
        });
    }

    const post =
      await prisma.post.create({
        data: {
          recruitmentId,

          code,

          name,

          vacancies:
            Number(
              vacancies || 0
            ),

          feeRules:
            feeRules ??
            null,

          formSchema:
            formSchema ??
            null,

          isActive:
            isActive ??
            true,
        },
      });

    // Send notification

    if (
      isActive !== false
    ) {
      const recruitment =
        await prisma.recruitment.findUnique(
          {
            where: {
              id: recruitmentId,
            },
          }
        );

      await notifyNewPost(
        post,
        recruitment
      ).catch((err) =>
        console.error(
          "[Post Notification Error]",
          err
        )
      );
    }

    res.json(post);
  } catch (error) {
    console.error(
      "[Create Post]",
      error
    );

    res.status(500).json({
      message:
        "Failed to create post",
    });
  }
};

export const getPostById =
  async (req, res) => {
    try {
      const id = Number(
        req.params.id
      );

      const post =
        await prisma.post.findUnique(
          {
            where: { id },

            include: {
              recruitment: true,
            },
          }
        );

      if (!post) {
        return res
          .status(404)
          .json({
            message:
              "Post not found",
          });
      }

      // DISABLED POST FIX

      if (
        post.isActive ===
        false
      ) {
        return res.status(403).json(
          {
            message:
              "This post is disabled",
          }
        );
      }

      // DISABLED RECRUITMENT FIX

      if (
        post.recruitment
          ?.isActive === false
      ) {
        return res.status(403).json(
          {
            message:
              "Recruitment disabled",
          }
        );
      }

      const updatedRecruitment =
        await updateRecruitmentExpiry(
          post.recruitment.id
        );

      res.json({
        ...post,

        recruitment: {
          ...updatedRecruitment,

          status:
            getRecruitmentStatus(
              updatedRecruitment
            ),
        },
      });
    } catch (error) {
      console.error(
        "[Get Post]",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch post",
      });
    }
  };

// Admin: update post
export const updatePost = async (
  req,
  res
) => {
  try {
    const id = Number(
      req.params.id
    );

    const {
      name,
      vacancies,
      feeRules,
      formSchema,
      isActive,
    } = req.body;

    const post =
      await prisma.post.update({
        where: { id },

        data: {
          ...(name !==
          undefined
            ? { name }
            : {}),

          ...(vacancies !==
          undefined
            ? {
                vacancies:
                  Number(
                    vacancies ||
                      0
                  ),
              }
            : {}),

          ...(feeRules !==
          undefined
            ? {
                feeRules:
                  feeRules ??
                  null,
              }
            : {}),

          ...(formSchema !==
          undefined
            ? {
                formSchema:
                  formSchema ??
                  null,
              }
            : {}),

          ...(isActive !==
          undefined
            ? {
                isActive:
                  Boolean(
                    isActive
                  ),
              }
            : {}),
        },
      });

    res.json(post);
  } catch (error) {
    console.error(
      "[Update Post]",
      error
    );

    res.status(500).json({
      message:
        "Failed to update post",
    });
  }
};