import { jest } from "@jest/globals";
import {
  verifyPaymentSignature,
  signPaymentPayload,
  getPaymentClient,
} from "../lib/paymentProvider.js";
import { AppError } from "../lib/errors.js";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://bihar:bihar@localhost:5432/bihar_recruitment";

jest.unstable_mockModule("../lib/prisma.js", () => ({
  default: {
    recruitment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    post: { count: jest.fn() },
  },
}));

const { isRecruitmentExpired, isRecruitmentAccepting } = await import(
  "../lib/recruitmentUtils.js"
);

describe("recruitmentUtils", () => {
  test("isRecruitmentExpired is false when endAt in future", () => {
    const recruitment = {
      endAt: new Date(Date.now() + 60_000),
    };
    expect(isRecruitmentExpired(recruitment)).toBe(false);
  });

  test("isRecruitmentExpired is true when endAt in past", () => {
    const recruitment = {
      endAt: new Date(Date.now() - 60_000),
    };
    expect(isRecruitmentExpired(recruitment)).toBe(true);
  });

  test("isRecruitmentAccepting requires active recruitment", () => {
    expect(
      isRecruitmentAccepting({
        isActive: false,
        startAt: new Date(Date.now() - 1000),
        endAt: new Date(Date.now() + 1000),
      })
    ).toBe(false);
  });

  test("isRecruitmentAccepting true for open window", () => {
    expect(
      isRecruitmentAccepting({
        isActive: true,
        startAt: new Date(Date.now() - 1000),
        endAt: new Date(Date.now() + 60_000),
      })
    ).toBe(true);
  });
});

describe("paymentProvider", () => {
  test("verifyPaymentSignature accepts matching hmac", () => {
    const secret = "s3cret";
    const signature = signPaymentPayload("order_1", "pay_1", secret);
    expect(
      verifyPaymentSignature({
        orderId: "order_1",
        paymentId: "pay_1",
        signature,
        secret,
      })
    ).toBe(true);
  });

  test("verifyPaymentSignature rejects mismatched hmac", () => {
    expect(
      verifyPaymentSignature({
        orderId: "order_1",
        paymentId: "pay_1",
        signature: "nope",
        secret: "s3cret",
      })
    ).toBe(false);
  });

  test("getPaymentClient returns mock in test env", async () => {
    process.env.NODE_ENV = "test";
    const client = getPaymentClient();
    const order = await client.orders.create({
      amount: 100,
      currency: "INR",
      receipt: "r1",
    });
    expect(order.id).toMatch(/^order_mock_/);
  });
});

describe("AppError", () => {
  test("stores status and details", () => {
    const err = new AppError("bad", 400, { field: "x" });
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: "x" });
    expect(err.isOperational).toBe(true);
  });
});
