import { jest } from "@jest/globals";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.RAZORPAY_KEY_ID = "rzp_test_key";
process.env.RAZORPAY_KEY_SECRET = "test_razorpay_secret";
process.env.MOCK_EXTERNAL_SERVICES = "true";

const prismaMock = {
  post: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
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
  recruitment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  admitCard: {
    count: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

jest.unstable_mockModule("../lib/prisma.js", () => ({
  default: prismaMock,
}));

jest.unstable_mockModule("../lib/notificationManager.js", () => ({
  notifyApplicationSubmitted: jest.fn().mockResolvedValue(undefined),
  notifyPaymentSuccess: jest.fn().mockResolvedValue(undefined),
  notifyPaymentFailed: jest.fn().mockResolvedValue(undefined),
  notifyNewPost: jest.fn().mockResolvedValue(undefined),
  notifyAdmitCardReady: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../lib/invoiceService.js", () => ({
  createOrGetInvoiceForPayment: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../lib/generateAdmitCardPdf.js", () => ({
  generateAdmitCardPdf: jest.fn().mockResolvedValue(Buffer.from("pdf")),
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

function acceptingRecruitment(overrides = {}) {
  const now = Date.now();
  return {
    id: 1,
    code: "REC1",
    title: "Test Recruitment",
    isActive: true,
    isExpired: false,
    startAt: new Date(now - 86400000),
    endAt: new Date(now + 86400000),
    ...overrides,
  };
}

const {
  createDraftApplication,
  updateApplication,
  submitApplication,
} = await import("../controllers/applicationController.js");

describe("applicationController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("createDraftApplication returns 400 when postId missing", async () => {
    const req = { body: {}, user: { id: 10 } };
    const res = mockRes();
    const next = jest.fn();

    await createDraftApplication(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(next.mock.calls[0][0].message).toMatch(/postId/i);
  });

  test("createDraftApplication returns existing application without creating", async () => {
    const existing = { id: 5, applicationNo: "APP-1", status: "DRAFT" };
    prismaMock.post.findUnique.mockResolvedValue({
      id: 2,
      isActive: true,
      recruitment: acceptingRecruitment(),
    });
    prismaMock.application.findFirst.mockResolvedValue(existing);

    const req = { body: { postId: 2 }, user: { id: 10 } };
    const res = mockRes();
    const next = jest.fn();

    await createDraftApplication(req, res, next);

    expect(res.json).toHaveBeenCalledWith(existing);
    expect(prismaMock.application.create).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("createDraftApplication creates draft when none exists", async () => {
    prismaMock.post.findUnique.mockResolvedValue({
      id: 2,
      isActive: true,
      recruitment: acceptingRecruitment(),
    });
    prismaMock.application.findFirst.mockResolvedValue(null);
    prismaMock.application.create.mockResolvedValue({
      id: 9,
      status: "DRAFT",
      postId: 2,
      userId: 10,
    });

    const req = { body: { postId: "2" }, user: { id: 10 } };
    const res = mockRes();
    const next = jest.fn();

    await createDraftApplication(req, res, next);

    expect(prismaMock.application.create).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DRAFT", postId: 2 })
    );
  });

  test("updateApplication rejects non-editable statuses", async () => {
    prismaMock.application.findFirst.mockResolvedValue({
      id: 1,
      status: "PAYMENT_SUCCESS",
      userId: 10,
    });

    const req = {
      params: { id: "1" },
      body: { data: { name: "Aman" } },
      user: { id: 10 },
    };
    const res = mockRes();
    const next = jest.fn();

    await updateApplication(req, res, next);

    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(next.mock.calls[0][0].message).toMatch(/not editable/i);
  });

  test("updateApplication updates data for DRAFT apps", async () => {
    prismaMock.application.findFirst.mockResolvedValue({
      id: 1,
      status: "DRAFT",
      userId: 10,
    });
    prismaMock.application.update.mockResolvedValue({
      id: 1,
      status: "DRAFT",
      data: { name: "Aman" },
    });

    const req = {
      params: { id: "1" },
      body: { data: { name: "Aman" } },
      user: { id: 10 },
    };
    const res = mockRes();
    const next = jest.fn();

    await updateApplication(req, res, next);

    expect(prismaMock.application.update).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "Aman" } })
    );
  });

  test("submitApplication moves DRAFT to PAYMENT_PENDING", async () => {
    prismaMock.application.findFirst.mockResolvedValue({
      id: 3,
      status: "DRAFT",
      userId: 10,
      post: { recruitment: acceptingRecruitment() },
    });
    prismaMock.application.update.mockResolvedValue({
      id: 3,
      status: "PAYMENT_PENDING",
    });

    const req = { params: { id: "3" }, user: { id: 10 } };
    const res = mockRes();
    const next = jest.fn();

    await submitApplication(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        application: expect.objectContaining({ status: "PAYMENT_PENDING" }),
      })
    );
  });

  test("submitApplication rejects already submitted applications", async () => {
    prismaMock.application.findFirst.mockResolvedValue({
      id: 3,
      status: "PAYMENT_PENDING",
      userId: 10,
      post: { recruitment: acceptingRecruitment() },
    });

    const req = { params: { id: "3" }, user: { id: 10 } };
    const res = mockRes();
    const next = jest.fn();

    await submitApplication(req, res, next);

    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(next.mock.calls[0][0].message).toMatch(/already submitted/i);
  });
});
