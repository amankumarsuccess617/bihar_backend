import { jest } from "@jest/globals";

export function mockNotifications() {
  const fn = () => jest.fn().mockResolvedValue(undefined);
  return {
    sendNotification: fn(),
    notifyRegistration: fn(),
    notifyLogin: fn(),
    notifyApplicationSubmitted: fn(),
    notifyPaymentSuccess: fn(),
    notifyPaymentFailed: fn(),
    notifyNoticePosted: fn(),
    notifyNewPost: fn(),
    notifyApplicationShortlisted: fn(),
    notifyApplicationRejected: fn(),
    notifyAdmitCardReady: fn(),
    notifyResultPublished: fn(),
    sendBulkNotification: fn(),
    getUserNotifications: fn(),
    markNotificationAsRead: fn(),
    markAllNotificationsAsRead: fn(),
    getUnreadCount: fn(),
  };
}
