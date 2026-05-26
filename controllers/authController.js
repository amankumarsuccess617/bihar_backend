import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { verifyCaptcha } from "../lib/captcha.js";
import { notifyRegistration, notifyLogin } from "../lib/notificationManager.js";
import {
  isLocked,
  recordAttempt,
  handleFailureAndMaybeLock,
} from "../lib/loginSecurity.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

async function verifyAndConsumeOtp({ channel, destination, purpose, code }) {
  const latest = await prisma.otp.findFirst({
    where: {
      channel,
      destination: String(destination).trim(),
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { id: "desc" },
  });

  if (!latest) return { ok: false, reason: "OTP not found/expired" };

  const ok = await bcrypt.compare(String(code), latest.codeHash);
  if (!ok) return { ok: false, reason: "Invalid OTP" };

  await prisma.otp.update({
    where: { id: latest.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true };
}

// REGISTER (Candidate by default) - OTP + CAPTCHA REQUIRED
export const register = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      otpChannel,
      otpDestination,
      otpCode,
      captchaToken,
    } = req.body;

    if (!JWT_SECRET) {
      return res.status(500).json({ message: "JWT_SECRET not set" });
    }

    // CAPTCHA mandatory
    const cap = await verifyCaptcha(captchaToken, req.ip);
    if (!cap.ok) {
      return res.status(400).json({ message: cap.reason });
    }

    // OTP mandatory
    if (!otpChannel || !otpDestination || !otpCode) {
      return res
        .status(400)
        .json({ message: "otpChannel, otpDestination, otpCode required" });
    }

    const otpRes = await verifyAndConsumeOtp({
      channel: otpChannel,
      destination: otpDestination,
      purpose: "REGISTER",
      code: otpCode,
    });

    if (!otpRes.ok) {
      return res.status(400).json({ message: otpRes.reason });
    }

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "name, email, password required" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash,
        role: "CANDIDATE",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    // Send registration notification
    await notifyRegistration(user).catch((err) =>
      console.error("[Register Notification Error]", err)
    );

    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message || "Register failed" });
  }
};

// LOGIN (password only) + lockout + audit log
export const login = async (req, res) => {
  const ip = req.ip;
  const ua = req.headers["user-agent"] || "";

  try {
    const { email, password } = req.body;

    if (!JWT_SECRET) {
      return res.status(500).json({ message: "JWT_SECRET not set" });
    }
    if (!email || !password) {
      return res.status(400).json({ message: "email, password required" });
    }

    // lock check (by email or ip)
    const lock = await isLocked({ email, ip });
    if (lock.locked) {
      await recordAttempt({
        email,
        ip,
        userAgent: ua,
        success: false,
        reason: "LOCKED",
      });
      return res.status(429).json({
        message: "Too many attempts. Try later.",
        lockedUntil: lock.lockedUntil,
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      await recordAttempt({
        email,
        ip,
        userAgent: ua,
        success: false,
        reason: "USER_NOT_FOUND",
      });

      const locked = await handleFailureAndMaybeLock({ email, ip });
      if (locked.locked) {
        return res.status(429).json({
          message: "Too many attempts. Try later.",
          lockedUntil: locked.lockedUntil,
        });
      }

      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      await recordAttempt({
        email,
        ip,
        userAgent: ua,
        success: false,
        reason: "INVALID_PASSWORD",
      });

      const locked = await handleFailureAndMaybeLock({ email, ip });
      if (locked.locked) {
        return res.status(429).json({
          message: "Too many attempts. Try later.",
          lockedUntil: locked.lockedUntil,
        });
      }

      return res.status(401).json({ message: "Invalid password" });
    }

    await recordAttempt({
      email,
      ip,
      userAgent: ua,
      success: true,
      reason: null,
    });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Send login notification
    await notifyLogin(user).catch((err) =>
      console.error("[Login Notification Error]", err)
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    await recordAttempt({
      email: req.body?.email || null,
      ip,
      userAgent: ua,
      success: false,
      reason: "ERROR",
    });

    res.status(400).json({ message: err.message || "Login failed" });
  }
};