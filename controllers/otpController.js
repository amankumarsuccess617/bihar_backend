import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";
import { verifyCaptcha } from "../lib/captcha.js";
import { sendOTPNotification } from "../lib/notificationService.js";

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

function normDestination(destination) {
  return String(destination || "").trim();
}

const ALLOWED_PURPOSES = ["REGISTER", "LOGIN", "RESET_PASSWORD"];

export const sendOtp = async (req, res) => {
  const { channel, destination, purpose, captchaToken } = req.body;

  // CAPTCHA mandatory (anti-spam)
  const cap = await verifyCaptcha(captchaToken, req.ip);
  if (!cap.ok) {
    return res.status(400).json({ message: cap.reason });
  }

  if (!channel || !destination || !purpose) {
    return res
      .status(400)
      .json({ message: "channel, destination, purpose required" });
  }
  if (!["EMAIL", "SMS"].includes(channel)) {
    return res.status(400).json({ message: "channel must be EMAIL or SMS" });
  }

  const purp = String(purpose).trim();
  if (!ALLOWED_PURPOSES.includes(purp)) {
    return res.status(400).json({ message: "invalid purpose" });
  }

  const dest = normDestination(destination);
  if (!dest) return res.status(400).json({ message: "invalid destination" });

  const ttlMin = Number(process.env.OTP_TTL_MINUTES || 10);

  // resend cooldown (seconds)
  const cooldownSec = Number(process.env.OTP_RESEND_COOLDOWN_SEC || 60);

  // max OTP per hour for same destination+purpose
  const maxPerHour = Number(process.env.OTP_MAX_PER_HOUR || 5);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // 1) throttle: max per hour
  const sentLastHour = await prisma.otp.count({
    where: {
      channel,
      destination: dest,
      purpose: purp,
      createdAt: { gte: oneHourAgo },
    },
  });
  if (sentLastHour >= maxPerHour) {
    return res
      .status(429)
      .json({ message: "Too many OTP requests. Try later." });
  }

  // 2) cooldown: prevent immediate resend
  const lastOtp = await prisma.otp.findFirst({
    where: { channel, destination: dest, purpose: purp },
    orderBy: { id: "desc" },
  });
  if (lastOtp) {
    const diffSec =
      (Date.now() - new Date(lastOtp.createdAt).getTime()) / 1000;
    if (diffSec < cooldownSec) {
      return res.status(429).json({
        message: `Please wait ${Math.ceil(cooldownSec - diffSec)} seconds`,
      });
    }
  }

  const code = genOtp();
  const codeHash = await bcrypt.hash(code, 10);

  const otp = await prisma.otp.create({
    data: {
      channel,
      destination: dest,
      purpose: purp,
      codeHash,
      expiresAt: new Date(Date.now() + ttlMin * 60 * 1000),
      attempts: 0,
    },
    select: {
      id: true,
      channel: true,
      destination: true,
      purpose: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  // Send OTP via selected channel (SMS or Email)
  try {
    await sendOTPNotification(channel, dest, code);
  } catch (error) {
    console.error("[OTP] Failed to send notification:", error);
    // Don't fail the request - OTP is still saved in DB
  }

  // Dev mode: return code for testing
  const devReturn = String(process.env.OTP_DEV_RETURN_CODE || "true") === "true";
  res.json(devReturn ? { ...otp, devCode: code } : otp);
};

export const verifyOtp = async (req, res) => {
  const { channel, destination, purpose, code } = req.body;

  if (!channel || !destination || !purpose || !code) {
    return res
      .status(400)
      .json({ message: "channel, destination, purpose, code required" });
  }
  if (!["EMAIL", "SMS"].includes(channel)) {
    return res.status(400).json({ message: "channel must be EMAIL or SMS" });
  }

  const purp = String(purpose).trim();
  if (!ALLOWED_PURPOSES.includes(purp)) {
    return res.status(400).json({ message: "invalid purpose" });
  }

  const dest = normDestination(destination);
  if (!dest) return res.status(400).json({ message: "invalid destination" });

  const maxAttempts = Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5);

  const latest = await prisma.otp.findFirst({
    where: {
      channel,
      destination: dest,
      purpose: purp,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { id: "desc" },
  });

  if (!latest)
    return res.status(400).json({ message: "OTP not found/expired" });

  if ((latest.attempts || 0) >= maxAttempts) {
    return res.status(429).json({
      message: "OTP attempts exceeded. Request new OTP.",
    });
  }

  const ok = await bcrypt.compare(String(code), latest.codeHash);

  // increment attempts on every verify try
  await prisma.otp.update({
    where: { id: latest.id },
    data: { attempts: (latest.attempts || 0) + 1 },
  });

  if (!ok) return res.status(400).json({ message: "Invalid OTP" });

  // consume OTP
  await prisma.otp.update({
    where: { id: latest.id },
    data: { consumedAt: new Date() },
  });

  res.json({ ok: true });
};