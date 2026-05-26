/**
 * Notification Routes
 * Handles all notification-related API endpoints
 */

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  listNotifications,
  getUnreadCountApi,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  sendBulkNotificationApi,
  getNotificationStats,
} from "../controllers/notificationApiController.js";

const router = express.Router();

// All notification routes require authentication
router.use(requireAuth);

/**
 * GET /api/notifications
 * Get user's notifications with pagination
 */
router.get("/", listNotifications);

/**
 * GET /api/notifications/unread/count
 * Get count of unread notifications
 */
router.get("/unread/count", getUnreadCountApi);

/**
 * GET /api/notifications/stats
 * Get notification statistics (admin only)
 */
router.get("/stats", getNotificationStats);

/**
 * PUT /api/notifications/:id/read
 * Mark single notification as read
 */
router.put("/:id/read", markAsRead);

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put("/read-all", markAllAsRead);

/**
 * DELETE /api/notifications/:id
 * Delete single notification
 */
router.delete("/:id", deleteNotification);

/**
 * DELETE /api/notifications/clear-all
 * Clear all notifications
 */
router.delete("/clear-all", clearAllNotifications);

/**
 * POST /api/notifications/bulk
 * Send bulk notification (admin only)
 */
router.post("/bulk", sendBulkNotificationApi);

export default router;
