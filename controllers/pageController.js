import prisma from "../lib/prisma.js";

// Public
export const getPublishedPageBySlug = async (req, res) => {
  const slug = String(req.params.slug);
  const page = await prisma.page.findFirst({
    where: { slug, status: "PUBLISHED" },
  });
  if (!page) return res.status(404).json({ message: "Page not found" });
  res.json(page);
};

export const listPublishedPages = async (req, res) => {
  const pages = await prisma.page.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: { slug: true, title: true, pinned: true, seoTitle: true, seoDescription: true, updatedAt: true },
    take: 200,
  });
  res.json(pages);
};

// Admin
export const adminUpsertPage = async (req, res) => {
  const { slug, title, contentHtml, status, pinned, seoTitle, seoDescription } = req.body;
  if (!slug || !title) return res.status(400).json({ message: "slug, title required" });

  const page = await prisma.page.upsert({
    where: { slug: String(slug) },
    create: {
      slug: String(slug),
      title,
      contentHtml: contentHtml || "",
      status: status || "DRAFT",
      pinned: Boolean(pinned),
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      updatedById: req.user.id,
    },
    update: {
      title,
      contentHtml: contentHtml ?? undefined,
      status: status ?? undefined,
      pinned: pinned !== undefined ? Boolean(pinned) : undefined,
      seoTitle: seoTitle ?? undefined,
      seoDescription: seoDescription ?? undefined,
      updatedById: req.user.id,
    },
  });

  res.json(page);
};

export const adminListPages = async (req, res) => {
  const pages = await prisma.page.findMany({
    orderBy: { updatedAt: "desc" },
    take: 500,
    include: { updatedBy: { select: { id: true, name: true, email: true } } },
  });
  res.json(pages);
};