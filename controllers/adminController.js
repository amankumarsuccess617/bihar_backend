import prisma from "../lib/prisma.js";

export const dashboardStats = async (req, res) => {
  const [
    users,
    recruitments,
    posts,
    applications,
    payments,
    admitCards,
    results,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.recruitment.count(),
    prisma.post.count(),
    prisma.application.count(),
    prisma.payment.count(),
    prisma.admitCard.count(),
    prisma.result.count(),
  ]);

  // application status breakdown
  const byStatusRaw = await prisma.application.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const applicationByStatus = Object.fromEntries(
    byStatusRaw.map((r) => [r.status, r._count._all])
  );

  // payment status breakdown
  const payByStatusRaw = await prisma.payment.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { amountPaise: true },
  });

  const paymentByStatus = payByStatusRaw.map((r) => ({
    status: r.status,
    count: r._count._all,
    amountPaise: r._sum.amountPaise || 0,
  }));

  res.json({
    users,
    recruitments,
    posts,
    applications,
    payments,
    admitCards,
    results,
    applicationByStatus,
    paymentByStatus,
  });
};