// src/modules/content/contentEntry.seo.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "../../utils/ApiError.js";

// Mock minimal untuk repository supaya dipakai di service.update()
vi.mock("./contentEntry.repository.js", () => {
  return {
    default: {
      findById: vi.fn().mockResolvedValue({
        id: "entry-1",
        workspaceId: "ws-1",
        contentTypeId: "ct-1",
        seoTitle: "Old title",
        metaDescription: "Old description",
        keywords: [],
        slug: "old-slug",
        isPublished: false,
        publishedAt: null,
        updatedById: null,
      }),
      isSlugTaken: vi.fn().mockResolvedValue(null),
    },
    findManyWithM2mRelated: vi.fn(),
  };
});

// Prisma & plan limit / enforceOnPayload tidak perlu dimock untuk case error 422,
// karena validation dijalankan SEBELUM query ke DB.

import contentEntryService from "./contentEntry.service.js";

describe("ContentEntryService SEO validation (B1 & B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create() should throw 422 SEO_TITLE_TOO_LONG when seoTitle exceeds 60 chars", async () => {
    const longTitle = "X".repeat(61);

    const payload = {
      workspaceId: "ws-1",
      contentTypeId: "ct-1",
      seoTitle: longTitle,
      metaDescription: "Deskripsi yang masih normal.",
      keywords: ["demo"],
      values: [],
    };

    await expect(contentEntryService.create(payload)).rejects.toMatchObject({
      status: 422,
      code: "SEO_TITLE_TOO_LONG",
      reason: "SEO_VALIDATION_FAILED",
    });
  });

  it("create() should throw 422 SEO_DESCRIPTION_TOO_LONG when metaDescription exceeds 160 chars", async () => {
    const longDescription = "D".repeat(161);

    const payload = {
      workspaceId: "ws-1",
      contentTypeId: "ct-1",
      seoTitle: "Judul normal",
      metaDescription: longDescription,
      keywords: ["demo"],
      values: [],
    };

    await expect(contentEntryService.create(payload)).rejects.toMatchObject({
      status: 422,
      code: "SEO_DESCRIPTION_TOO_LONG",
      reason: "SEO_VALIDATION_FAILED",
    });
  });

  it("update() should also enforce SEO_TITLE_TOO_LONG rule", async () => {
    const longTitle = "Y".repeat(80);

    const payload = {
      seoTitle: longTitle,
      metaDescription: "Deskripsi normal",
      keywords: ["test"],
      values: [],
    };

    await expect(
      contentEntryService.update("entry-1", "ws-1", payload)
    ).rejects.toMatchObject({
      status: 422,
      code: "SEO_TITLE_TOO_LONG",
      reason: "SEO_VALIDATION_FAILED",
    });
  });

  it("create() should allow valid seoTitle and metaDescription lengths", async () => {
    // Di sini kita hanya cek bahwa TIDAK dilempar error 422 dari SEO.
    const payload = {
      workspaceId: "ws-1",
      contentTypeId: "ct-1",
      seoTitle: "Judul di bawah 60 karakter",
      metaDescription:
        "Deskripsi meta yang berada di bawah 160 karakter tetapi cukup informatif.",
      keywords: ["demo"],
      values: [],
    };

    let error = null;
    try {
      await contentEntryService.create(payload);
    } catch (e) {
      error = e;
    }

    // Kalau ada error pun, jangan sampai error SEO validation.
    if (error instanceof ApiError) {
      expect(error.code).not.toBe("SEO_TITLE_TOO_LONG");
      expect(error.code).not.toBe("SEO_DESCRIPTION_TOO_LONG");
    }
  });
});
