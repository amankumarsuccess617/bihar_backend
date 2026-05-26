import sgMail from "@sendgrid/mail";
import twilio from "twilio";

// Initialize Twilio (only if credentials are available)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

// Initialize SendGrid (only if API key is available)
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Send SMS via Twilio
 * @param {string} phoneNumber - Phone number with country code (e.g., +91XXXXXXXXXX)
 * @param {string} message - Message text
 * @returns {Promise<boolean>} - Success/failure
 */
export const sendSMS = async (phoneNumber, message) => {
  if (!twilioClient) {
    console.warn(
      "[SMS] Twilio not configured. Skipping SMS send for:",
      phoneNumber
    );
    return false;
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    console.warn("[SMS] TWILIO_PHONE_NUMBER not set. Cannot send SMS.");
    return false;
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    console.log("[SMS] Sent successfully:", result.sid);
    return true;
  } catch (error) {
    console.error("[SMS] Error sending SMS:", error.message);
    return false;
  }
};

/**
 * Send Email via SendGrid
 * @param {string} to - Email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @returns {Promise<boolean>} - Success/failure
 */
export const sendEmail = async (to, subject, html) => {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("[Email] SendGrid not configured. Skipping email send to:", to);
    return false;
  }

  if (!process.env.SENDGRID_FROM_EMAIL) {
    console.warn("[Email] SENDGRID_FROM_EMAIL not set. Cannot send email.");
    return false;
  }

  try {
    const result = await sgMail.send({
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject,
      html,
    });

    console.log("[Email] Sent successfully to:", to);
    return true;
  } catch (error) {
    console.error("[Email] Error sending email:", error.message);
    return false;
  }
};

/**
 * Send OTP via SMS or Email
 * @param {string} channel - "SMS" or "EMAIL"
 * @param {string} destination - Phone number or email
 * @param {string} otp - OTP code
 * @returns {Promise<boolean>} - Success/failure
 */
export const sendOTPNotification = async (channel, destination, otp) => {
  if (channel === "SMS") {
    const message = `Your OTP is: ${otp}. Valid for 10 minutes. Do not share this code.`;
    return await sendSMS(destination, message);
  } else if (channel === "EMAIL") {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Email Verification</h2>
          <p style="color: #666; text-align: center; font-size: 16px;">Your OTP code is:</p>
          <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="color: #0066cc; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #999; text-align: center; font-size: 14px;">This code is valid for 10 minutes.</p>
          <p style="color: #999; text-align: center; font-size: 14px;">Never share this code with anyone.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; text-align: center; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
      </div>
    `;
    return await sendEmail(destination, "Your OTP Code", html);
  }

  return false;
};

/**
 * Send Application Status Email
 */
export const sendApplicationStatusEmail = async (
  email,
  name,
  applicationId,
  status
) => {
  const statusMessages = {
    SUBMITTED: "Your application has been received successfully.",
    PAYMENT_SUCCESS:
      "Payment received. Your application is now active.",
    PAYMENT_FAILED:
      "Payment failed. Please try again to complete your application.",
    UNDER_REVIEW: "Your application is now under review.",
    SHORTLISTED: "Congratulations! You have been shortlisted.",
    REJECTED: "We regret to inform you that your application was not selected.",
  };

  const message = statusMessages[status] || `Status updated: ${status}`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Application Update</h2>
        <p style="color: #666;">Dear ${name},</p>
        <p style="color: #666;">${message}</p>
        <p style="color: #666;">
          <strong>Application ID:</strong> ${applicationId}<br/>
          <strong>Current Status:</strong> <span style="color: #0066cc; font-weight: bold;">${status}</span>
        </p>
        <p style="color: #666;">You can track your application status anytime by logging into your account.</p>
        <p style="color: #999; font-size: 12px;">This is an automated email. Please do not reply to this email.</p>
      </div>
    </div>
  `;

  return await sendEmail(email, `Application Status: ${status}`, html);
};

/**
 * Send Payment Confirmation Email
 */
export const sendPaymentConfirmationEmail = async (
  email,
  name,
  paymentId,
  amount
) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Payment Confirmation</h2>
        <p style="color: #666;">Dear ${name},</p>
        <p style="color: #666;">Your payment has been received successfully.</p>
        <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #666; margin: 5px 0;"><strong>Payment ID:</strong> ${paymentId}</p>
          <p style="color: #666; margin: 5px 0;"><strong>Amount:</strong> ₹${amount}</p>
          <p style="color: #666; margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        <p style="color: #666;">An invoice has been generated and will be available in your account shortly.</p>
        <p style="color: #666;">Thank you for your payment.</p>
        <p style="color: #999; font-size: 12px;">This is an automated email. Please do not reply to this email.</p>
      </div>
    </div>
  `;

  return await sendEmail(email, "Payment Confirmation", html);
};

/**
 * Send Admit Card Email
 */
export const sendAdmitCardEmail = async (email, name, rollNumber) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
      <div style="background-color: white; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Your Admit Card is Ready</h2>
        <p style="color: #666;">Dear ${name},</p>
        <p style="color: #666;">Your admit card has been generated successfully.</p>
        <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="color: #666; margin: 5px 0;"><strong>Roll Number:</strong> ${rollNumber}</p>
          <p style="color: #666; margin: 5px 0;"><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        <p style="color: #666;">Please download and print your admit card from your account dashboard. Keep it safe for the exam.</p>
        <p style="color: #666;">Good luck with your exam!</p>
        <p style="color: #999; font-size: 12px;">This is an automated email. Please do not reply to this email.</p>
      </div>
    </div>
  `;

  return await sendEmail(email, "Your Admit Card is Ready", html);
};

export default {
  sendSMS,
  sendEmail,
  sendOTPNotification,
  sendApplicationStatusEmail,
  sendPaymentConfirmationEmail,
  sendAdmitCardEmail,
};
