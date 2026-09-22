import { jest } from "@jest/globals";

process.env.NODE_ENV = "test";
process.env.ADMIT_ROLL_PREFIX = "TEST";

const prismaMock = {
  post: {
    findUnique: jest.fn(),
  },
  application: {
    findMany: jest.fn(),
  },
  admitCard: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.unstable_mockModule("../lib/prisma.js", () => ({
  default: prismaMock,
}));

jest.unstable_mockModule("../lib/notificationManager.js", () => ({
  notifyAdmitCardReady: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../lib/generateAdmitCardPdf.js", () => ({
  generateAdmitCardPdf: jest.fn().mockResolvedValue(Buffer.from("pdf")),
}));

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });
  return res;
}

const { generateAdmitCardsForPost } = await import(
  "../controllers/admitCardController.js"
);

describe("admitCardController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("generateAdmitCardsForPost requires examDate, shift, centers", async () => {
    const req = { params: { postId: "1" }, body: {} };
    const res = mockRes();

    await generateAdmitCardsForPost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/examDate, shift, centers/i);
  });

  test("generateAdmitCardsForPost returns 404 when post missing", async () => {
    prismaMock.post.findUnique.mockResolvedValue(null);

    const req = {
      params: { postId: "1" },
      body: {
        examDate: "2026-11-01",
        shift: "MORNING",
        centers: ["Patna"],
      },
    };
    const res = mockRes();

    await generateAdmitCardsForPost(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("generateAdmitCardsForPost creates cards for paid applications", async () => {
    prismaMock.post.findUnique.mockResolvedValue({
      id: 1,
      code: "CLK",
      recruitment: { code: "REC1" },
    });
    prismaMock.admitCard.count.mockResolvedValue(0);
    prismaMock.application.findMany.mockResolvedValue([
      {
        id: 101,
        admitCard: null,
        user: { id: 9, name: "Aman", email: "a@example.com" },
      },
    ]);
    prismaMock.admitCard.create.mockResolvedValue({ id: 1, rollNo: "TEST-REC1-CLK-000001" });

    const req = {
      params: { postId: "1" },
      body: {
        examDate: "2026-11-01",
        shift: "MORNING",
        centers: ["Patna"],
      },
    };
    const res = mockRes();

    await generateAdmitCardsForPost(req, res);

    expect(prismaMock.admitCard.create).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        created: expect.any(Number),
      })
    );
  });
});
