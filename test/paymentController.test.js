import { jest } from "@jest/globals";
import crypto from "crypto";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.RAZORPAY_KEY_ID = "rzp_test_key";
process.env.RAZORPAY_KEY_SECRET = "test_razorpay_secret";
process.env.MOCK_EXTERNAL_SERVICES = "true";

const prismaMock = {
  application: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
  post: {
    findUnique: jest.fn(),
  },
};

jest.unstable_mockModule("../lib/prisma.js", () => ({
  default: prismaMock,
}));

jest.unstable_mockModule("../lib/notificationManager.js", () => ({
  notifyPaymentSuccess: jest.fn().mockResolvedValue(undefined),
  notifyPaymentFailed: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../lib/invoiceService.js", () => ({
  createOrGetInvoiceForPayment: jest.fn().mockResolvedValue(undefined),
}));

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });
  return res;
}

function sign(orderId, paymentId) {
  return crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

const { verifyPayment, createOrder } = await import(
  "../controllers/paymentController.js"
);

describe("paymentController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("verifyPayment rejects on signature mismatch", async () => {
    prismaMock.application.findFirst.mockResolvedValue({
      id: 11,
      userId: 7,
      postId: 2,
      status: "PAYMENT_PENDING",
    });
    prismaMock.application.update.mockResolvedValue({});

    const req = {
      user: { id: 7 },
      body: {
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "bad-signature",
        applicationId: 11,
      },
    };
    const res = mockRes();
    const next = jest.fn();

    await verifyPayment(req, res, next);

    expect(prismaMock.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "PAYMENT_FAILED" },
      })
    );
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(next.mock.calls[0][0].message).toMatch(/Signature mismatch/i);
  });

  test("verifyPayment updates application to PAYMENT_SUCCESS on valid signature", async () => {
    prismaMock.application.findFirst.mockResolvedValue({
      id: 11,
      userId: 7,
      postId: 2,
      status: "PAYMENT_PENDING",
    });
    prismaMock.payment.findFirst
      .mockResolvedValueOnce({ id: 99, orderId: "order_1" })
      .mockResolvedValueOnce({ id: 99, orderId: "order_1", status: "SUCCESS" });
    prismaMock.payment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.application.update.mockResolvedValue({
      id: 11,
      status: "PAYMENT_SUCCESS",
    });
    prismaMock.post.findUnique.mockResolvedValue({ id: 2, name: "Clerk" });

    const orderId = "order_ok";
    const paymentId = "pay_ok";
    const req = {
      user: { id: 7 },
      body: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sign(orderId, paymentId),
        applicationId: 11,
      },
    };
    const res = mockRes();
    const next = jest.fn();

    await verifyPayment(req, res, next);

    expect(prismaMock.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "PAYMENT_SUCCESS" },
      })
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  test("createOrder creates mock razorpay order without network", async () => {
    prismaMock.application.findFirst.mockResolvedValue({
      id: 5,
      userId: 7,
      applicationNo: "APP-123",
      data: { category: "GENERAL" },
      post: { feeRules: { GENERAL: 50000 } },
    });
    prismaMock.payment.create.mockResolvedValue({ id: 1, orderId: "order_mock_1" });
    prismaMock.application.update.mockResolvedValue({});

    const req = { user: { id: 7 }, body: { applicationId: 5 } };
    const res = mockRes();
    const next = jest.fn();

    await createOrder(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: expect.stringMatching(/^order_mock_/),
        amountPaise: 50000,
      })
    );
  });

  test("createOrder returns 400 when fee not configured", async () => {
    prismaMock.application.findFirst.mockResolvedValue({
      id: 5,
      userId: 7,
      applicationNo: "APP-123",
      data: {},
      post: { feeRules: {} },
    });

    const req = { user: { id: 7 }, body: { applicationId: 5 } };
    const res = mockRes();
    const next = jest.fn();

    await createOrder(req, res, next);

    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(next.mock.calls[0][0].message).toMatch(/Fee not configured/i);
  });
});
