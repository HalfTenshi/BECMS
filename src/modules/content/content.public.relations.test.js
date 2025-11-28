// src/modules/content/content.public.relations.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock relations.expander → kita mau observasi pemanggilan expandRelations()
// ---------------------------------------------------------------------------
vi.mock("./relations.expander.js", () => ({
  expandRelations: vi.fn(async () => new Map()),
}));

// Setelah di-mock, baru import expandRelations sebagai mock function
import { expandRelations as expandRelationsMock } from "./relations.expander.js";

// ---------------------------------------------------------------------------
// Mock prisma untuk dipakai oleh content.public.routes.js
// ---------------------------------------------------------------------------
vi.mock("../../config/prismaClient.js", () => {
  const mockPrisma = {
    contentType: {
      findFirst: vi.fn(),
    },
    contentEntry: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };

  return { default: mockPrisma };
});

import prisma from "../../config/prismaClient.js";
import publicRouter from "../../routes/public/content.public.routes.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

// Helper kecil untuk mengambil handler GET "/:contentType"
function getListHandlerFromRouter() {
  const layer = publicRouter.stack.find(
    (l) => l.route && l.route.path === "/:contentType" && l.route.methods.get
  );
  if (!layer) {
    throw new Error("Route GET /:contentType not found in public router");
  }
  // ambil handler terakhir di stack route (handler utama setelah middleware include)
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

beforeEach(() => {
  // Reset semua spy / mock call count
  vi.clearAllMocks();

  // Pastikan expandRelationsMock bersih & punya default behaviour
  expandRelationsMock.mockReset();
  expandRelationsMock.mockResolvedValue(new Map());

  // Sample ContentType & entries untuk route public
  prisma.contentType.findFirst.mockResolvedValue({
    id: "ct_article",
    apiKey: "article",
    name: "Article",
    seoEnabled: true,
  });

  prisma.contentEntry.findMany.mockImplementation(async (args = {}) => {
    const where = args.where || {};
    const workspaceId = where.workspaceId;
    const ctId = where.contentTypeId;
    const isPublished = where.isPublished;

    // Satu entry demo
    const all = [
      {
        id: "e1",
        workspaceId: "ws1",
        contentTypeId: "ct_article",
        slug: "hello-world",
        seoTitle: "Hello World",
        metaDescription: "Demo",
        keywords: ["demo"],
        publishedAt: new Date("2025-11-27T14:17:09.711Z"),
        createdAt: new Date("2025-11-27T14:17:09.711Z"),
      },
    ];

    let rows = all.filter((e) => {
      if (workspaceId && e.workspaceId !== workspaceId) return false;
      if (ctId && e.contentTypeId !== ctId) return false;
      if (typeof isPublished === "boolean" && e.isPublished !== isPublished) {
        // di dummy kita tidak set isPublished, anggap true by default
      }
      return true;
    });

    return rows;
  });

  prisma.contentEntry.count.mockResolvedValue(1);
});

describe("Public Content API – relations query behaviour", () => {
  it("tanpa relations → expandRelations tidak dipanggil, _relations tidak ada", async () => {
    const handler = getListHandlerFromRouter();

    const req = {
      params: { contentType: "article" },
      query: {
        // tidak ada relations / include=relations
      },
      headers: {
        "x-workspace-id": "ws1",
      },
      workspace: null,
      workspaceId: null,
    };

    const res = createMockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeTruthy();
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows[0]._relations).toBeUndefined();

    // Karena include tidak mengandung "relations", expandRelations tidak dipanggil
    expect(expandRelationsMock).not.toHaveBeenCalled();
  });

  it("relations=1 & relationsDepth=1 → expandRelations dipanggil dengan depth=1", async () => {
    const handler = getListHandlerFromRouter();

    // Mock return Map dari expandRelations supaya _relations ada di response
    expandRelationsMock.mockResolvedValue(
      new Map([
        [
          "e1",
          {
            author: { id: "author1", slug: "author-1", seoTitle: "Author 1" },
          },
        ],
      ])
    );

    const req = {
      params: { contentType: "article" },
      query: {
        include: "relations", // penting: aktifkan include relations
        relations: "author", // whitelist (tidak terlalu dipakai di test ini)
        relationsDepth: "1",
      },
      headers: {
        "x-workspace-id": "ws1",
      },
      workspace: null,
      workspaceId: null,
    };

    const res = createMockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(expandRelationsMock).toHaveBeenCalledTimes(1);

    const args = expandRelationsMock.mock.calls[0][0];
    expect(args.depth).toBe(1);

    const rows = res.body.rows;
    expect(rows[0]._relations).toBeDefined();
    expect(rows[0]._relations.author).toMatchObject({
      id: "author1",
      slug: "author-1",
      seoTitle: "Author 1",
    });
  });

  it("relations=1 & relationsDepth=10 → route clamp ke 5 saat memanggil expandRelations", async () => {
    const handler = getListHandlerFromRouter();

    expandRelationsMock.mockResolvedValue(new Map());

    const req = {
      params: { contentType: "article" },
      query: {
        include: "relations",
        relations: "author",
        relationsDepth: "10", // out of range
      },
      headers: {
        "x-workspace-id": "ws1",
      },
      workspace: null,
      workspaceId: null,
    };

    const res = createMockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(expandRelationsMock).toHaveBeenCalledTimes(1);

    const args = expandRelationsMock.mock.calls[0][0];
    // content.public.routes clamp: depth = max(1, min(5, Number(relationsDepth||1)))
    expect(args.depth).toBe(5);
  });

  it('include="values" saja tanpa relations → expandRelations tidak dipanggil', async () => {
    const handler = getListHandlerFromRouter();

    const req = {
      params: { contentType: "article" },
      query: {
        include: "values", // hanya values
      },
      headers: {
        "x-workspace-id": "ws1",
      },
      workspace: null,
      workspaceId: null,
    };

    const res = createMockRes();
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(expandRelationsMock).not.toHaveBeenCalled();
  });
});
