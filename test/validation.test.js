import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import { mockNotifications } from "./helpers/mockNotifications.js";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.RAZORPAY_KEY_ID = "rzp_test_key";
process.env.RAZORPAY_KEY_SECRET = "test_razorpay_secret";
process.env.MOCK_EXTERNAL_SERVICES = "true";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://bihar:bihar@localhost:5432/bihar_recruitment";

jest.unstable_mockModule("../lib/prisma.js", () => ({
  default: {
    post: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    application: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    recruitment: { findUnique: jest.fn(), findMany: jest.fn() },
    admitCard: { count: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() },
    refund: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

jest.unstable_mockModule("../lib/cache.js", () => ({
  initRedis: jest.fn(),
  cacheMiddleware: () => (req, res, next) => next(),
}));

jest.unstable_mockModule("../lib/notificationManager.js", () =>
  mockNotifications()
);

jest.unstable_mockModule("../lib/invoiceService.js", () => ({
  createOrGetInvoiceForPayment: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../lib/generateAdmitCardPdf.js", () => ({
  generateAdmitCardPdf: jest.fn().mockResolvedValue(Buffer.from("pdf")),
}));

const { createApp } = await import("../app.js");
const app = createApp();

function token(role = "ADMIN", id = 1) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET);
}

describe("request validation", () => {
  test("POST /api/posts/recruitment/:id returns 400 when code/name missing", async () => {
    const res = await request(app)
      .post("/api/posts/recruitment/1")
      .set("Authorization", `Bearer ${token("ADMIN")}`)
      .send({ vacancies: 10 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/i);
  });

  test("POST /api/payments/create-order returns 400 when applicationId missing", async () => {
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${token("CANDIDATE", 9)}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/i);
  });

  test("POST /api/admit-cards/generate/post/:id returns 400 when centers missing", async () => {
    const res = await request(app)
      .post("/api/admit-cards/generate/post/3")
      .set("Authorization", `Bearer ${token("ADMIN")}`)
      .send({ examDate: "2026-10-01", shift: "MORNING" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Validation failed/i);
  });

  test("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("GET /metrics returns memory stats", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.body.memory).toBeDefined();
  });
});
