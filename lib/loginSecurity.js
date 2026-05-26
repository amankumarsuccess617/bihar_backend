import prisma from "../lib/prisma.js";

export async function isLocked({ email, ip }) {
  const now = new Date();

  const lock = await prisma.loginLock.findFirst({
    where: {
      lockedUntil: { gt: now },
      OR: [
        email ? { email } : undefined,
        ip ? { ip } : undefined,
      ].filter(Boolean),
    },
  });

  return lock ? { locked: true, lockedUntil: lock.lockedUntil, reason: lock.reason } : { locked: false };
}

export async function recordAttempt({ email, ip, userAgent, success, reason }) {
  await prisma.loginAttempt.create({
    data: {
      email: email || null,
      ip,
      userAgent: userAgent || null,
      success,
      reason: reason || null,
    },
  });
}

export async function handleFailureAndMaybeLock({ email, ip }) {
  const maxFails = Number(process.env.LOGIN_MAX_FAILS || 5);
  const lockMin = Number(process.env.LOGIN_LOCK_MINUTES || 15);

  const since = new Date(Date.now() - lockMin * 60 * 1000);

  const failCount = await prisma.loginAttempt.count({
    where: {
      success: false,
      createdAt: { gte: since },
      OR: [
        email ? { email } : undefined,
        { ip },
      ].filter(Boolean),
    },
  });

  if (failCount >= maxFails) {
    const lockedUntil = new Date(Date.now() + lockMin * 60 * 1000);

    // lock by email if available else by ip
    if (email) {
      await prisma.loginLock.upsert({
        where: { email },
        update: { lockedUntil, reason: "Too many failed logins" },
        create: { email, lockedUntil, reason: "Too many failed logins" },
      });
    } else {
      await prisma.loginLock.upsert({
        where: { ip },
        update: { lockedUntil, reason: "Too many failed logins" },
        create: { ip, lockedUntil, reason: "Too many failed logins" },
      });
    }

    return { locked: true, lockedUntil };
  }

  return { locked: false, failCount };
}