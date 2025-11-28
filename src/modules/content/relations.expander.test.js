// src/modules/content/relations.expander.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma client yang dipakai di relations.expander.js
vi.mock("../../config/prismaClient.js", () => {
  const mockPrisma = {
    contentField: {
      findMany: vi.fn(),
    },
    contentRelation: {
      findMany: vi.fn(),
    },
    contentRelationM2M: {
      findMany: vi.fn(),
    },
    contentEntry: {
      findMany: vi.fn(),
    },
  };

  return { default: mockPrisma };
});

import prisma from "../../config/prismaClient.js";
import { expandRelations } from "./relations.expander.js";

let relationFields;
let oneManyLinks;
let m2mLinks;
let targetEntries;

beforeEach(() => {
  // Reset mock implementation & data setiap test
  relationFields = [
    // Root CT: article → RELATION author (MANY_TO_ONE)
    {
      id: "field_author",
      apiKey: "author",
      name: "Author",
      type: "RELATION",
      contentTypeId: "ct_article",
      relation: {
        id: "rel_author",
        kind: "MANY_TO_ONE",
        targetContentTypeId: "ct_author",
      },
    },
    // CT author → RELATION company (MANY_TO_ONE), dipakai untuk depth > 1
    {
      id: "field_company",
      apiKey: "company",
      name: "Company",
      type: "RELATION",
      contentTypeId: "ct_author",
      relation: {
        id: "rel_company",
        kind: "MANY_TO_ONE",
        targetContentTypeId: "ct_company",
      },
    },
  ];

  // Link non-M2M (ContentRelation)
  oneManyLinks = [
    // article( root1 ) → author1
    {
      fromEntryId: "root1",
      fieldId: "field_author",
      toEntryId: "author1",
      position: 0,
    },
    // author1 → company1 (dipakai di depth 2)
    {
      fromEntryId: "author1",
      fieldId: "field_company",
      toEntryId: "company1",
      position: 0,
    },
  ];

  // Untuk test ini kita tidak butuh M2M, tapi mock tetap disiapkan
  m2mLinks = [];

  // Target entries (yang akan di-resolve oleh fetchEntrySummaries)
  targetEntries = [
    {
      id: "author1",
      slug: "author-1",
      seoTitle: "Author 1",
      metaDescription: "Author desc",
      publishedAt: new Date("2025-01-02T00:00:00Z"),
      isPublished: true,
      contentTypeId: "ct_author",
      values: [{ fieldId: "name", valueString: "Author 1" }],
    },
    {
      id: "company1",
      slug: "company-1",
      seoTitle: "Company 1",
      metaDescription: "Company desc",
      publishedAt: new Date("2025-01-03T00:00:00Z"),
      isPublished: true,
      contentTypeId: "ct_company",
      values: [{ fieldId: "name", valueString: "Company 1" }],
    },
    {
      id: "author_unpublished",
      slug: "author-unpub",
      seoTitle: "Author Unpublished",
      metaDescription: "Hidden",
      publishedAt: new Date("2025-01-04T00:00:00Z"),
      isPublished: false,
      contentTypeId: "ct_author",
      values: [],
    },
  ];

  // Reset semua mock prisma
  prisma.contentField.findMany.mockReset();
  prisma.contentRelation.findMany.mockReset();
  prisma.contentRelationM2M.findMany.mockReset();
  prisma.contentEntry.findMany.mockReset();

  // Implementasi mock prisma:

  // contentField.findMany → filter berdasarkan contentTypeId & type
  prisma.contentField.findMany.mockImplementation(async ({ where }) => {
    const ctId = where?.contentTypeId;
    const type = where?.type;
    return relationFields.filter((f) => {
      if (ctId && f.contentTypeId !== ctId) return false;
      if (type && f.type !== type) return false;
      return true;
    });
  });

  // ContentRelation (non-M2M)
  prisma.contentRelation.findMany.mockImplementation(async ({ where }) => {
    const fromIds = where?.fromEntryId?.in || [];
    const fieldIds = where?.fieldId?.in || [];
    return oneManyLinks.filter((l) => {
      if (fromIds.length && !fromIds.includes(l.fromEntryId)) return false;
      if (fieldIds.length && !fieldIds.includes(l.fieldId)) return false;
      // workspaceId diabaikan di mock
      return true;
    });
  });

  // ContentRelationM2M
  prisma.contentRelationM2M.findMany.mockImplementation(async ({ where }) => {
    const fromIds = where?.fromEntryId?.in || [];
    const relFieldIds = where?.relationFieldId?.in || [];
    return m2mLinks.filter((l) => {
      if (fromIds.length && !fromIds.includes(l.fromEntryId)) return false;
      if (relFieldIds.length && !relFieldIds.includes(l.relationFieldId)) {
        return false;
      }
      return true;
    });
  });

  // contentEntry.findMany untuk fetchEntrySummaries
  prisma.contentEntry.findMany.mockImplementation(async (args = {}) => {
    const where = args.where || {};
    const ids = where.id?.in || [];
    const requirePublished = where.isPublished === true;

    let rows = targetEntries.filter((e) => {
      if (ids.length && !ids.includes(e.id)) return false;
      if (requirePublished && !e.isPublished) return false;
      return true;
    });

    // sort publishedAt desc (kurang penting di test ini)
    if (rows.length && rows[0].publishedAt) {
      rows = rows
        .slice()
        .sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime()
        );
    }

    // summary "basic" → pakai select
    if (args.select) {
      return rows.map((e) => {
        const obj = {};
        for (const key of Object.keys(args.select)) {
          if (args.select[key]) obj[key] = e[key];
        }
        return obj;
      });
    }

    // summary "full" → include values
    if (args.include?.values) {
      return rows.map((e) => ({
        ...e,
        values: e.values || [],
      }));
    }

    return rows;
  });
});

describe("expandRelations (unit) – depth behaviour", () => {
  const rootEntries = [
    { id: "root1", contentTypeId: "ct_article" },
    { id: "root2", contentTypeId: "ct_article" },
  ];

  it("depth = 0 → tidak expand relasi (map kosong per entry)", async () => {
    const result = await expandRelations({
      workspaceId: "ws1",
      entries: rootEntries,
      contentTypeId: "ct_article",
      depth: 0,
      summary: "basic",
    });

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);

    const r1 = result.get("root1");
    const r2 = result.get("root2");

    expect(r1).toEqual({});
    expect(r2).toEqual({});
  });

  it("depth = 1 → relasi level-1 terisi (article.author)", async () => {
    const result = await expandRelations({
      workspaceId: "ws1",
      entries: rootEntries,
      contentTypeId: "ct_article",
      depth: 1,
      summary: "basic",
    });

    const r1 = result.get("root1");
    const r2 = result.get("root2");

    expect(r1).toBeDefined();
    expect(r1.author).toBeDefined();
    expect(r1.author.id).toBe("author1");
    expect(r1.author.slug).toBe("author-1");
    expect(r1.author.seoTitle).toBe("Author 1");
    // depth=1 → tidak ada nested _relations di target
    expect(r1.author._relations).toBeUndefined();

    // root2 tidak punya relasi
    expect(r2).toEqual({});
  });

  it("depth > 1 → nested relasi ikut terisi (author.company)", async () => {
    const result = await expandRelations({
      workspaceId: "ws1",
      entries: rootEntries,
      contentTypeId: "ct_article",
      depth: 2,
      summary: "basic",
    });

    const r1 = result.get("root1");
    expect(r1).toBeDefined();
    const author = r1.author;
    expect(author).toBeDefined();

    // depth=2 → author._relations.company terisi
    expect(author._relations).toBeDefined();
    expect(author._relations.company).toBeDefined();
    expect(author._relations.company.id).toBe("company1");
    expect(author._relations.company.slug).toBe("company-1");
  });

  it("depth > maxDepth → di-clamp, hasil secara struktur sama seperti maxDepth (tanpa relasi lebih dalam)", async () => {
    const resDepth2 = await expandRelations({
      workspaceId: "ws1",
      entries: rootEntries,
      contentTypeId: "ct_article",
      depth: 2,
      summary: "basic",
    });

    const resDepth10 = await expandRelations({
      workspaceId: "ws1",
      entries: rootEntries,
      contentTypeId: "ct_article",
      depth: 10,
      summary: "basic",
    });

    const r1_2 = resDepth2.get("root1");
    const r1_10 = resDepth10.get("root1");

    // Helper: drop _relations yang kosong dari snapshot untuk perbandingan
    const normalize = (obj) =>
      JSON.parse(
        JSON.stringify(obj, (key, value) => {
          if (key === "_relations" && value && Object.keys(value).length === 0) {
            return undefined; // jangan ikut di-serialize
          }
          return value;
        })
      );

    // Struktur relasi untuk root1 harus identik secara semantik
    expect(normalize(r1_10)).toEqual(normalize(r1_2));

    // Extra guard: di kasus depth "kelebihan", tidak boleh ada relasi lebih dalam dari company
    const companyAt10 = r1_10?.author?._relations?.company;
    expect(companyAt10).toBeDefined();
    // Jika ada _relations di company, harus kosong (tidak ada nested relasi lagi)
    expect(companyAt10._relations ?? {}).toEqual({});
  });
});

describe("expandRelations (unit) – summary basic vs full", () => {
  const rootEntries = [{ id: "root1", contentTypeId: "ct_article" }];

  it('summary = "basic" → target minimal (tidak ada values)', async () => {
    const result = await expandRelations({
      workspaceId: "ws1",
      entries: rootEntries,
      contentTypeId: "ct_article",
      depth: 1,
      summary: "basic",
    });

    const r1 = result.get("root1");
    const author = r1?.author;
    expect(author).toBeDefined();

    // Basic summary: punya id / slug / seoTitle / metaDescription / publishedAt / contentTypeId
    expect(author.id).toBeDefined();
    expect(author.slug).toBeDefined();
    expect(author.seoTitle).toBeDefined();
    expect(author.contentTypeId).toBeDefined();

    // Tidak ada values di summary basic
    expect(author.values).toBeUndefined();
  });

  it('summary = "full" → target punya values', async () => {
    const result = await expandRelations({
      workspaceId: "ws1",
      entries: rootEntries,
      contentTypeId: "ct_article",
      depth: 1,
      summary: "full",
    });

    const r1 = result.get("root1");
    const author = r1?.author;
    expect(author).toBeDefined();
    expect(author.id).toBe("author1");

    // Full summary: include values[]
    expect(Array.isArray(author.values)).toBe(true);
    expect(author.values[0]).toMatchObject({
      fieldId: "name",
      valueString: "Author 1",
    });
  });
});

describe("expandRelations (unit) – scope (public vs admin)", () => {
  const rootEntries = [{ id: "root1", contentTypeId: "ct_article" }];

  it('default / scope="public" → target unpublished di-filter', async () => {
    // Tambah link ke author_unpublished sebagai test filter
    oneManyLinks.push({
      fromEntryId: "root1",
      fieldId: "field_author",
      toEntryId: "author_unpublished",
      position: 1,
    });

    const result = await expandRelations({
      workspaceId: "ws1",
      entries: rootEntries,
      contentTypeId: "ct_article",
      depth: 1,
      summary: "basic",
      scope: "public",
    });

    const r1 = result.get("root1");
    const author = r1?.author;

    // Karena fetchEntrySummaries selalu pakai isPublished = true,
    // hanya author1 yang muncul, author_unpublished ter-filter.
    expect(author).toBeDefined();
    expect(author.id).toBe("author1");
  });

  // TODO: ketika nanti implement scope="admin" (tanpa filter isPublished),
  // tambahkan test baru di sini yang mengharapkan author_unpublished ikut muncul.
});
