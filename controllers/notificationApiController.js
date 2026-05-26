/**
 * Notification API Controller
 * Handles notification retrieval, marking as read, etc.
 */

import prisma from "../lib/prisma.js";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  sendBulkNotification,
} from "../lib/notificationManager.js";

/**
 * Get user's notifications
 * GET /api/notifications?limit=20&skip=0
 */
export const listNotifications = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = Number(req.query.skip) || 0;

    const { notifications, total } = await getUserNotifications(
      req.user.id,
      limit,
      skip
    );

    res.json({
      notifications,
      total,
      limit,
      skip,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[Notifications API] Error:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

/**
 * Get unread notification count
 * GET /api/notifications/unread/count
 */
export const getUnreadCountApi = async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.id);
    res.json({ unreadCount: count });
  } catch (error) {
    console.error("[Unread Count API] Error:", error);
    res.status(500).json({ message: "Failed to fetch count" });
  }
};

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
export const markAsRead = async (req, res) => {
  try {
    const notificationId = Number(req.params.id);

    // Verify notification belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const updated = await markNotificationAsRead(notificationId);
    res.json(updated);
  } catch (error) {
    console.error("[Mark Read API] Error:", error);
    res.status(500).json({ message: "Failed to mark as read" });
  }
};

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
export const markAllAsRead = async (req, res) => {
  try {
    const result = await markAllNotificationsAsRead(req.user.id);
    res.json({ updated: result.count });
  } catch (error) {
    console.error("[Mark All Read API] Error:", error);
    res.status(500).json({ message: "Failed to mark all as read" });
  }
};

/**
 * Delete notification
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res) => {
  try {
    const notificationId = Number(req.params.id);

    // Verify notification belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    res.json({ deleted: true });
  } catch (error) {
    console.error("[Delete Notification API] Error:", error);
    res.status(500).json({ message: "Failed to delete" });
  }
};

/**
 * Clear all notifications (admin)
 * DELETE /api/notifications/clear-all
 */
export const clearAllNotifications = async (req, res) => {
  try {
    // Only admin/super admin can clear for others
    if (req.query.userId && req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const userId = req.query.userId ? Number(req.query.userId) : req.user.id;

    const result = await prisma.notification.deleteMany({
      where: { userId },
    });

    res.json({ deleted: result.count });
  } catch (error) {
    console.error("[Clear All API] Error:", error);
    res.status(500).json({ message: "Failed to clear notifications" });
  }
};

/**
 * Send bulk notification (ADMIN ONLY)
 * POST /api/notifications/bulk
 * Body: { title, message, smsMessage, filter? }
 * filter: { role, isActive, email, etc. }
 */
export const sendBulkNotificationApi = async (req, res) => {
  try {
    // Admin only
    if (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Admin only" });
    }

    const { title, message, smsMessage, filter = {} } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: "title and message required" });
    }

    console.log(
      `[Bulk Notification] Sending from admin ${req.user.id}`,
      filter
    );

    const results = await sendBulkNotification(
      title,
      message,
      smsMessage,
      filter
    );

    res.json({
      sent: results.filter((r) => r).length,
      total: results.length,
      message: `Notification sent to ${results.filter((r) => r).length} users`,
    });
  } catch (error) {
    console.error("[Bulk Notification API] Error:", error);
    res.status(500).json({ message: "Failed to send bulk notification" });
  }
};

/**
 * Get notification statistics (ADMIN)
 * GET /api/notifications/stats
 */
export const getNotificationStats = async (req, res) => {
  try {
    // Admin only
    if (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Admin only" });
    }

    const total = await prisma.notification.count();
    const unread = await prisma.notification.count({
      where: { isRead: false },
    });
    const byType = await prisma.notification.groupBy({
      by: ["type"],
      _count: { id: true },
    });

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await prisma.notification.count({
      where: { createdAt: { gte: last24h } },
    });

    res.json({
      total,
      unread,
      recent24h: recentCount,
      byType,
    });
  } catch (error) {
    console.error("[Stats API] Error:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};

export default {
  listNotifications,
  getUnreadCountApi,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  sendBulkNotificationApi,
  getNotificationStats,
};
