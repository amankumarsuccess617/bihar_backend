/**
 * Notification System - Handles all user notifications
 * Supports: Registration, Login, Application, Payment, Notice, Post
 */

import prisma from "../lib/prisma.js";
import {
  sendSMS,
  sendEmail,
  sendApplicationStatusEmail,
  sendPaymentConfirmationEmail,
  sendAdmitCardEmail,
} from "./notificationService.js";

/**
 * NOTIFICATION TYPES
 */
const NOTIFICATION_TYPES = {
  REGISTRATION: "REGISTRATION",
  LOGIN: "LOGIN",
  APPLICATION_SUBMITTED: "APPLICATION_SUBMITTED",
  APPLICATION_SHORTLISTED: "APPLICATION_SHORTLISTED",
  APPLICATION_REJECTED: "APPLICATION_REJECTED",
  PAYMENT_SUCCESS: "PAYMENT_SUCCESS",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  NOTICE_POSTED: "NOTICE_POSTED",
  POST_PUBLISHED: "POST_PUBLISHED",
  ADMIT_CARD_READY: "ADMIT_CARD_READY",
  RESULT_PUBLISHED: "RESULT_PUBLISHED",
};

/**
 * Send notification via SMS + Email
 */
export const sendNotification = async (
  userId,
  type,
  title,
  message,
  smsMessage,
  metadata = {}
) => {
  try {
    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.warn("[Notification] User not found:", userId);
      return false;
    }

    // Save notification to database
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        metadata,
        isRead: false,
      },
    });

    // Send SMS if phone available
    if (user.phone) {
      const smsText =
        smsMessage ||
        `${title}: ${message.substring(0, 100)}...`.substring(0, 160);
      await sendSMS(user.phone, smsText).catch((err) =>
        console.error("[SMS Error]", err)
      );
    }

    // Send Email
    if (user.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${title}</h2>
            <p style="color: #666; line-height: 1.6;">${message}</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This is an automated notification from Bihar Recruitment Portal.
            </p>
          </div>
        </div>
      `;

      await sendEmail(user.email, title, emailHtml).catch((err) =>
        console.error("[Email Error]", err)
      );
    }

    console.log(
      `[Notification] Sent ${type} to user ${userId} (${user.email})`
    );
    return notification;
  } catch (error) {
    console.error("[Notification] Error:", error.message);
    return null;
  }
};

/**
 * Registration Notification
 */
export const notifyRegistration = async (user) => {
  const message = `Welcome ${user.name}! Your account has been created successfully. You can now login and apply for positions.`;
  const smsMessage = `Welcome to Bihar Recruitment Portal! Your registration is complete.`;

  return sendNotification(
    user.id,
    NOTIFICATION_TYPES.REGISTRATION,
    "Account Created Successfully",
    message,
    smsMessage,
    { email: user.email, phone: user.phone }
  );
};

/**
 * Login Notification
 */
export const notifyLogin = async (user) => {
  const message = `You have logged in successfully. If this wasn't you, please change your password immediately.`;
  const smsMessage = `You logged in to Bihar Recruitment. If not you, change password.`;

  return sendNotification(
    user.id,
    NOTIFICATION_TYPES.LOGIN,
    "Login Successful",
    message,
    smsMessage,
    { loginTime: new Date(), ip: "tracking-enabled" }
  );
};

/**
 * Application Submitted Notification
 */
export const notifyApplicationSubmitted = async (application, user, post) => {
  const message = `Your application for position "${post.title}" has been submitted successfully. 
  Application No: ${application.applicationNo}
  Status: Under Review
  Next step: Complete payment to activate your application.`;

  const smsMessage = `Application submitted! Ref: ${application.applicationNo}. Complete payment to activate.`;

  return sendNotification(
    user.id,
    NOTIFICATION_TYPES.APPLICATION_SUBMITTED,
    "Application Submitted",
    message,
    smsMessage,
    { applicationId: application.id, applicationNo: application.applicationNo, postId: post.id }
  );
};

/**
 * Payment Success Notification
 */
export const notifyPaymentSuccess = async (user, payment, application, post) => {
  const amountRupees = (payment.amountPaise / 100).toFixed(2);
  const message = `Payment of ₹${amountRupees} received successfully for application "${post.title}".
  Receipt ID: ${payment.id}
  Your application is now active and under review.`;

  const smsMessage = `Payment successful! ₹${amountRupees} for ${post.title}. Your app is now active.`;

  return sendNotification(
    user.id,
    NOTIFICATION_TYPES.PAYMENT_SUCCESS,
    "Payment Confirmed",
    message,
    smsMessage,
    { paymentId: payment.id, applicationId: application.id, amount: amountRupees }
  );
};

/**
 * Payment Failed Notification
 */
export const notifyPaymentFailed = async (user, reason = "Transaction failed") => {
  const message = `Your payment transaction failed. Reason: ${reason}. Please try again.`;
  const smsMessage = `Payment failed. Please retry or contact support.`;

  return sendNotification(
    user.id,
    NOTIFICATION_TYPES.PAYMENT_FAILED,
    "Payment Failed",
    message,
    smsMessage,
    { reason }
  );
};

/**
 * Notice Posted Notification - Send to all users
 */
export const notifyNoticePosted = async (notice) => {
  const message = `New Notice: ${notice.title}
  Category: ${notice.category}
  Posted: ${new Date(notice.createdAt).toLocaleDateString()}
  
  ${notice.description}`;

  const smsMessage = `New Notice: ${notice.title}. Check portal for details.`;

  // Get all active users
  const users = await prisma.user.findMany({
    where: { isActive: true },
  });

  console.log(`[Notice] Sending notification to ${users.length} users`);

  // Send to all users
  const results = await Promise.all(
    users.map((user) =>
      sendNotification(
        user.id,
        NOTIFICATION_TYPES.NOTICE_POSTED,
        `New Notice: ${notice.title}`,
        message,
        smsMessage,
        { noticeId: notice.id, category: notice.category }
      ).catch((err) => {
        console.error("[Notice] Error for user", user.id, err);
        return null;
      })
    )
  );

  console.log(`[Notice] Sent to ${results.filter((r) => r).length} users`);
  return results;
};

/**
 * New Post/Recruitment Notification - Send to relevant users
 */
export const notifyNewPost = async (post, recruitment) => {
  const message = `New position opened: "${post.title}"
  Organization: ${recruitment.organizationName}
  Category: ${post.category}
  Closing Date: ${new Date(post.applicationDeadline).toLocaleDateString()}
  Application Fee: ₹${(post.feeRules?.GENERAL || 0) / 100}
  
  Apply now on the portal!`;

  const smsMessage = `New job: ${post.title} at ${recruitment.organizationName}. Apply now!`;

  // Get all active candidates
  const users = await prisma.user.findMany({
    where: { isActive: true, role: "CANDIDATE" },
  });

  console.log(`[Post] Sending notification to ${users.length} candidates`);

  const results = await Promise.all(
    users.map((user) =>
      sendNotification(
        user.id,
        NOTIFICATION_TYPES.POST_PUBLISHED,
        `New Job Opening: ${post.title}`,
        message,
        smsMessage,
        { postId: post.id, recruitmentId: recruitment.id }
      ).catch((err) => {
        console.error("[Post] Error for user", user.id, err);
        return null;
      })
    )
  );

  console.log(`[Post] Sent to ${results.filter((r) => r).length} users`);
  return results;
};

/**
 * Application Shortlisted Notification
 */
export const notifyApplicationShortlisted = async (user, application, post) => {
  const message = `Congratulations! You have been shortlisted for the position "${post.title}".
  Application No: ${application.applicationNo}
  Next Step: You will receive interview details shortly.`;

  const smsMessage = `Congratulations! You are shortlisted for ${post.title}. Check portal for details.`;

  return sendNotification(
    user.id,
    NOTIFICATION_TYPES.APPLICATION_SHORTLISTED,
    "You Have Been Shortlisted!",
    message,
    smsMessage,
    { applicationId: application.id, postId: post.id }
  );
};

/**
 * Application Rejected Notification
 */
export const notifyApplicationRejected = async (user, application, post) => {
  const message = `We regret to inform you that your application for "${post.title}" has not been selected.
  Application No: ${application.applicationNo}
  Please apply for other positions available on the portal.`;

  const smsMessage = `Your app for ${post.title} was not selected. Try other positions.`;

  return sendNotification(
    user.id,
    NOTIFICATION_TYPES.APPLICATION_REJECTED,
    "Application Status",
    message,
    smsMessage,
    { applicationId: application.id, postId: post.id }
  );
};

/**
 * Admit Card Ready Notification
 */
export const notifyAdmitCardReady = async (user, admitCard) => {
  const message = `Your admit card for exam is ready! 
  Roll Number: ${admitCard.rollNumber}
  Download from the portal immediately and keep it safe.`;

  const smsMessage = `Your admit card is ready! Roll No: ${admitCard.rollNumber}. Download now.`;

  return sendNotification(
    user.id,
    NOTIFICATION_TYPES.ADMIT_CARD_READY,
    "Admit Card Ready",
    message,
    smsMessage,
    { admitCardId: admitCard.id, rollNumber: admitCard.rollNumber }
  );
};

/**
 * Result Published Notification
 */
export const notifyResultPublished = async (post) => {
  const message = `Results for "${post.title}" have been published! 
  Check the Results section in the portal to view your score and merit position.`;

  const smsMessage = `Results are out for ${post.title}! Check your score in the portal.`;

  // Find all candidates who applied for this post
  const applications = await prisma.application.findMany({
    where: { postId: post.id, status: "PAYMENT_SUCCESS" },
    include: { user: true },
  });

  console.log(
    `[Result] Sending notification to ${applications.length} applicants`
  );

  const results = await Promise.all(
    applications.map((app) =>
      sendNotification(
        app.user.id,
        NOTIFICATION_TYPES.RESULT_PUBLISHED,
        `Results Published: ${post.title}`,
        message,
        smsMessage,
        { postId: post.id }
      ).catch((err) => {
        console.error("[Result] Error for user", app.user.id, err);
        return null;
      })
    )
  );

  console.log(`[Result] Sent to ${results.filter((r) => r).length} users`);
  return results;
};

/**
 * Bulk Send Notification (Admin Feature)
 */
export const sendBulkNotification = async (
  title,
  message,
  smsMessage,
  userFilter = {}
) => {
  try {
    // Get users matching filter
    const users = await prisma.user.findMany({
      where: userFilter,
    });

    console.log(`[Bulk] Sending to ${users.length} users`);

    const results = await Promise.all(
      users.map((user) =>
        sendNotification(
          user.id,
          "BULK_NOTIFICATION",
          title,
          message,
          smsMessage,
          { bulkSent: new Date() }
        ).catch((err) => {
          console.error("[Bulk] Error for user", user.id, err);
          return null;
        })
      )
    );

    console.log(`[Bulk] Successfully sent to ${results.filter((r) => r).length}`);
    return results;
  } catch (error) {
    console.error("[Bulk] Error:", error);
    return [];
  }
};

/**
 * Get User Notifications
 */
export const getUserNotifications = async (userId, limit = 20, skip = 0) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    });

    const total = await prisma.notification.count({
      where: { userId },
    });

    return { notifications, total };
  } catch (error) {
    console.error("[Notifications] Error fetching:", error);
    return { notifications: [], total: 0 };
  }
};

/**
 * Mark Notification as Read
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  } catch (error) {
    console.error("[Notification] Error marking read:", error);
    return null;
  }
};

/**
 * Mark All as Read
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    return await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  } catch (error) {
    console.error("[Notifications] Error marking all read:", error);
    return null;
  }
};

/**
 * Get Unread Count
 */
export const getUnreadCount = async (userId) => {
  try {
    return await prisma.notification.count({
      where: { userId, isRead: false },
    });
  } catch (error) {
    console.error("[Notification] Error counting unread:", error);
    return 0;
  }
};

export default {
  sendNotification,
  notifyRegistration,
  notifyLogin,
  notifyApplicationSubmitted,
  notifyPaymentSuccess,
  notifyPaymentFailed,
  notifyNoticePosted,
  notifyNewPost,
  notifyApplicationShortlisted,
  notifyApplicationRejected,
  notifyAdmitCardReady,
  notifyResultPublished,
  sendBulkNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  NOTIFICATION_TYPES,
};
