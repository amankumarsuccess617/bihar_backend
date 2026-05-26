import prisma from "../lib/prisma.js";
import {
  isRecruitmentExpired,
  isRecruitmentAccepting,
  updateRecruitmentExpiry,
  getRecruitmentStatus,
} from "../lib/recruitmentUtils.js";

// Public/Candidate: active recruitments (only accepting applications)
export const listActiveRecruitments = async (req, res) => {
  try {
    const items = await prisma.recruitment.findMany({
      where: {
        isActive: true,
        isExpired: false, // Only non-expired
      },
      orderBy: { createdAt: "desc" },
      include: {
        posts: {
          where: { isActive: true },
          orderBy: { id: "asc" },
        },
      },
    });

    // Add status info to each recruitment
    const itemsWithStatus = items.map((rec) => ({
      ...rec,
      status: getRecruitmentStatus(rec),
    }));

    res.json(itemsWithStatus);
  } catch (error) {
    console.error("[List Active Recruitments]", error);
    res.status(500).json({ message: "Failed to fetch recruitments" });
  }
};

// Admin: list all recruitments (including expired)
export const listAllRecruitments = async (req, res) => {
  try {
    // Update expiry status for all recruitments first
    const items = await prisma.recruitment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        posts: {
          orderBy: { id: "asc" },
        },
      },
    });

    // Check and update each recruitment's expiry status
    const itemsWithUpdatedStatus = await Promise.all(
      items.map(async (rec) => {
        const updated = await updateRecruitmentExpiry(rec.id);
        return {
          ...updated,
          status: getRecruitmentStatus(updated),
        };
      })
    );

    res.json(itemsWithUpdatedStatus);
  } catch (error) {
    console.error("[List All Recruitments]", error);
    res.status(500).json({ message: "Failed to fetch recruitments" });
  }
};

// Admin: create recruitment
export const createRecruitment = async (req, res) => {
  try {
    const { code, title, description, startAt, endAt, isActive, metadata } = req.body;
    if (!code || !title) return res.status(400).json({ message: "code, title required" });

    // Check if dates are provided and valid
    const startDate = startAt ? new Date(startAt) : null;
    const endDate = endAt ? new Date(endAt) : null;

    // Determine if recruitment is expired at creation
    const isExpired = endDate ? new Date() > endDate : false;

    const item = await prisma.recruitment.create({
      data: {
        code,
        title,
        description: description || null,
        startAt: startDate,
        endAt: endDate,
        isActive: isActive ?? true,
        isExpired, // Set based on dates
        metadata: metadata ?? null,
      },
      include: {
        posts: true,
      },
    });

    res.json({
      ...item,
      status: getRecruitmentStatus(item),
    });
  } catch (error) {
    console.error("[Create Recruitment]", error);
    res.status(500).json({ message: "Failed to create recruitment", error: error.message });
  }
};

// Admin: update recruitment
export const updateRecruitment = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, description, startAt, endAt, isActive, metadata } = req.body;

    const startDate = startAt !== undefined ? (startAt ? new Date(startAt) : null) : undefined;
    const endDate = endAt !== undefined ? (endAt ? new Date(endAt) : null) : undefined;

    // Determine new isExpired status
    const updateData = {};
    if (startDate !== undefined) updateData.startAt = startDate;
    if (endDate !== undefined) updateData.endAt = endDate;

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (metadata !== undefined) updateData.metadata = metadata ?? null;

    // Check if recruitment should be marked as expired
    const endDateToCheck = endDate !== undefined ? endDate : undefined;
    if (endDateToCheck) {
      const isExpired = new Date() > endDateToCheck;
      updateData.isExpired = isExpired;
      // Auto-disable if expired
      if (isExpired) {
        updateData.isActive = false;
      }
    }

    const item = await prisma.recruitment.update({
      where: { id },
      data: updateData,
      include: {
        posts: true,
      },
    });

    res.json({
      ...item,
      status: getRecruitmentStatus(item),
    });
  } catch (error) {
    console.error("[Update Recruitment]", error);
    res.status(500).json({ message: "Failed to update recruitment", error: error.message });
  }
};

export const toggleRecruitmentStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const recruitment = await prisma.recruitment.findUnique({
      where: { id },
    });

    if (!recruitment) {
      return res.status(404).json({ message: "Recruitment not found" });
    }

    const updated = await prisma.recruitment.update({
      where: { id },
      data: {
        isActive: !recruitment.isActive,
      },
      include: {
        posts: true,
      },
    });

    res.json({
      ...updated,
      status: getRecruitmentStatus(updated),
    });
  } catch (error) {
    console.error("[Toggle Recruitment]", error);
    res.status(500).json({ message: "Failed to toggle recruitment status", error: error.message });
  }
};