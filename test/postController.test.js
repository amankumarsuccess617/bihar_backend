import { jest } from "@jest/globals";

process.env.NODE_ENV = "test";

const prismaMock = {
  post: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  recruitment: {
    findUnique: jest.fn(),
  },
};

jest.unstable_mockModule("../lib/prisma.js", () => ({
  default: prismaMock,
}));

jest.unstable_mockModule("../lib/notificationManager.js", () => ({
  notifyNewPost: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../lib/recruitmentUtils.js", () => ({
  updateRecruitmentExpiry: jest.fn().mockResolvedValue(undefined),
  getRecruitmentStatus: jest.fn(() => "OPEN"),
  disableRecruitmentIfNoPostsAsync: jest.fn().mockResolvedValue(undefined),
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

const { createPost, listAllPosts, getPostById } = await import(
  "../controllers/postController.js"
);

describe("postController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("createPost returns 400 when code/name missing", async () => {
    const req = { params: { recruitmentId: "1" }, body: {} };
    const res = mockRes();

    await createPost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toMatch(/code, name required/i);
  });

  test("createPost creates a post with vacancies", async () => {
    prismaMock.post.create.mockResolvedValue({
      id: 10,
      code: "CLK",
      name: "Clerk",
      vacancies: 5,
    });
    prismaMock.recruitment.findUnique.mockResolvedValue({
      id: 1,
      title: "2026 Drive",
    });

    const req = {
      params: { recruitmentId: "1" },
      body: { code: "CLK", name: "Clerk", vacancies: 5 },
    };
    const res = mockRes();

    await createPost(req, res);

    expect(prismaMock.post.create).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CLK", name: "Clerk" })
    );
  });

  test("listAllPosts returns posts", async () => {
    prismaMock.post.findMany.mockResolvedValue([{ id: 1, code: "CLK" }]);
    const res = mockRes();
    await listAllPosts({}, res);
    expect(res.json).toHaveBeenCalledWith([{ id: 1, code: "CLK" }]);
  });

  test("getPostById returns 404 when missing", async () => {
    prismaMock.post.findUnique.mockResolvedValue(null);
    const req = { params: { id: "99" } };
    const res = mockRes();
    await getPostById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
