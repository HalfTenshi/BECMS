// =========================================================
// src/modules/content/contentEntry.service.test.js
// =========================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

import contentEntryService from "./contentEntry.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

// --------- Mock prisma -----------------------------------
vi.mock("../../config/prismaClient.js", () => {
  const contentType = {
    findFirst: vi.fn(),
  };

  const contentEntry = {
    create: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  };

  const fieldValue = {
    create: vi.fn(),
    deleteMany: vi.fn(),
  };

  const contentRelation = {
    create: vi.fn(),
    deleteMany: vi.fn(),
  };

  const prisma = {
    contentType,
    contentEntry,
    fieldValue,
    contentRelation,
    $transaction: (fn) => fn(prisma),
  };

  return { default: prisma };
});

// --------- Mock contentEntry.repository -------------------
vi.mock("./contentEntry.repository.js", () => {
  const repo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    isSlugTaken: vi.fn(),
    delete: vi.fn(),
    publish: vi.fn(),
  };

  const findManyWithM2mRelated = vi.fn();

  return {
    default: repo,
    findManyWithM2mRelated,
  };
});

// --------- Mock entry.validation --------------------------
vi.mock("./entry.validation.js", () => {
  return {
    enforceOnPayload: vi.fn(),
  };
});

// --------- Mock slug generator ----------------------------
vi.mock("../../utils/slugGenerator.js", () => ({
  generateSlug: vi.fn((s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
  ),
}));

// --------- Mock SEO utils --------------------------------
vi.mock("../../utils/seoUtils.js", () => ({
  normalizeSeoFields: vi.fn((data) => data),
  MAX_SEO_TITLE_LENGTH: 60,
  MAX_META_DESCRIPTION_LENGTH: 160,
}));

// --------- Mock planLimit.service ------------------------
vi.mock("../../services/planLimit.service.js", () => {
  const PLAN_LIMIT_ACTIONS = {
    ADD_MEMBER: "ADD_MEMBER",
    ADD_CONTENT_TYPE: "ADD_CONTENT_TYPE",
    ADD_ENTRY: "ADD_ENTRY",
  };

  return {
    PLAN_LIMIT_ACTIONS,
    enforcePlanLimit: vi.fn(),
  };
});

// --------- Mock denorm.service ---------------------------
vi.mock("../../services/denorm.service.js", () => ({
  recomputeDenormForTargetChange: vi.fn(),
}));

// --------- Imports mock instance untuk inspeksi ----------
import prisma from "../../config/prismaClient.js";
import contentEntryRepository, {
  findManyWithM2mRelated,
} from "./contentEntry.repository.js";
import { enforceOnPayload } from "./entry.validation.js";
import { generateSlug } from "../../utils/slugGenerator.js";
import {
  normalizeSeoFields,
} from "../../utils/seoUtils.js";
import {
  enforcePlanLimit,
  PLAN_LIMIT_ACTIONS,
} from "../../services/planLimit.service.js";
import { recomputeDenormForTargetChange } from "../../services/denorm.service.js";

describe("ContentEntryService (core lifecycle)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =======================================================
  // CREATE
  // =======================================================
  describe("create()", () => {
    it("should throw ApiError CONTENT_ENTRY_CREATE_VALIDATION_ERROR when workspaceId/contentTypeId missing", async () => {
      await expect(
        contentEntryService.create({})
      ).rejects.toBeInstanceOf(ApiError);

      await expect(
        contentEntryService.create({})
      ).rejects.toHaveProperty(
        "code",
        ERROR_CODES.CONTENT_ENTRY_CREATE_VALIDATION_ERROR
      );
    });

    it("should create entry (happy path) with SEO + values + relations", async () => {
      const payload = {
        workspaceId: "ws_1",
        contentTypeId: "ct_1",
        seoTitle: "Hello World",
        metaDescription: "Short desc",
        keywords: ["demo"],
        isPublished: true,
        values: [{ apiKey: "title", value: "Hello World" }],
      };

      prisma.contentType.findFirst.mockResolvedValue({
        id: "ct_1",
        seoEnabled: true,
      });

      enforceOnPayload.mockResolvedValue({
        fieldValues: [
          { fieldId: "field_title", key: "valueString", value: "Hello World" },
        ],
        relations: [
          { fieldId: "rel_author", targetIds: ["entry_author_1"] },
        ],
        generated: { slug: "hello-world" },
      });

      contentEntryRepository.isSlugTaken.mockResolvedValue(false);

      prisma.contentEntry.create.mockResolvedValue({
        id: "entry_1",
        workspaceId: "ws_1",
        contentTypeId: "ct_1",
        slug: "hello-world",
        seoTitle: "Hello World",
        metaDescription: "Short desc",
        keywords: ["demo"],
        isPublished: true,
        publishedAt: null,
      });

      const result = await contentEntryService.create(payload);

      // Normalisasi SEO dipanggil
      expect(normalizeSeoFields).toHaveBeenCalled();

      // Cek enforceOnPayload dipanggil dengan ctId & values
      expect(enforceOnPayload).toHaveBeenCalledWith({
        contentTypeId: "ct_1",
        entryId: null,
        values: payload.values,
      });

      // Plan limit
      expect(enforcePlanLimit).toHaveBeenCalledWith(
        "ws_1",
        PLAN_LIMIT_ACTIONS.ADD_ENTRY
      );

      // Slug generator dipakai ketika perlu
      expect(generateSlug).toHaveBeenCalledWith("Hello World");

      // Cek fieldValue & relation disimpan di dalam transaction
      expect(prisma.fieldValue.create).toHaveBeenCalledWith({
        data: {
          entryId: "entry_1",
          fieldId: "field_title",
          valueString: "Hello World",
        },
      });

      expect(prisma.contentRelation.create).toHaveBeenCalledWith({
        data: {
          workspaceId: "ws_1",
          fieldId: "rel_author",
          fromEntryId: "entry_1",
          toEntryId: "entry_author_1",
        },
      });

      // Denorm hook
      expect(recomputeDenormForTargetChange).toHaveBeenCalledWith({
        workspaceId: "ws_1",
        targetEntryId: "entry_1",
      });

      expect(result).toMatchObject({
        id: "entry_1",
        slug: "hello-world",
        isPublished: true,
      });
    });

    it("should throw ApiError SLUG_CONFLICT when slug already taken", async () => {
      const payload = {
        workspaceId: "ws_1",
        contentTypeId: "ct_1",
        seoTitle: "Hello World",
        values: [],
      };

      // ContentType harus selalu ketemu
      prisma.contentType.findFirst.mockResolvedValue({
        id: "ct_1",
        seoEnabled: true,
      });

      enforceOnPayload.mockResolvedValue({
        fieldValues: [],
        relations: [],
        generated: { slug: "hello-world" },
      });

      // Simulasikan slug sudah dipakai
      contentEntryRepository.isSlugTaken.mockResolvedValue(true);

      await expect(
        contentEntryService.create(payload)
      ).rejects.toMatchObject({
        code: ERROR_CODES.SLUG_CONFLICT,
      });
    });
  });

  // =======================================================
  // UPDATE
  // =======================================================
  describe("update()", () => {
    const existingEntry = {
      id: "entry_1",
      workspaceId: "ws_1",
      contentTypeId: "ct_1",
      slug: "hello-world",
      seoTitle: "Hello World",
      metaDescription: "Short desc",
      keywords: ["demo"],
      isPublished: false,
      publishedAt: null,
      updatedById: null,
    };

    it("should throw CONTENT_ENTRY_NOT_FOUND when entry does not exist", async () => {
      contentEntryRepository.findById.mockResolvedValueOnce(null);

      await expect(
        contentEntryService.update("entry_missing", "ws_1", {})
      ).rejects.toBeInstanceOf(ApiError);

      await expect(
        contentEntryService.update("entry_missing", "ws_1", {})
      ).rejects.toHaveProperty(
        "code",
        ERROR_CODES.CONTENT_ENTRY_NOT_FOUND
      );
    });

    it("should update entry and re-run validation + denorm", async () => {
      contentEntryRepository.findById.mockResolvedValueOnce(existingEntry);

      prisma.contentType.findFirst.mockResolvedValueOnce({
        id: "ct_1",
        seoEnabled: true,
      });

      enforceOnPayload.mockResolvedValueOnce({
        fieldValues: [
          {
            fieldId: "field_title",
            key: "valueString",
            value: "Updated Title",
          },
        ],
        relations: [],
        generated: {},
      });

      contentEntryRepository.isSlugTaken.mockResolvedValueOnce(false);

      prisma.contentEntry.update.mockResolvedValueOnce({
        ...existingEntry,
        seoTitle: "Updated Title",
      });

      const patch = {
        seoTitle: "Updated Title",
        values: [{ apiKey: "title", value: "Updated Title" }],
        isPublished: true,
      };

      const result = await contentEntryService.update(
        "entry_1",
        "ws_1",
        patch
      );

      // Validasi payload
      expect(enforceOnPayload).toHaveBeenCalledWith({
        contentTypeId: "ct_1",
        entryId: "entry_1",
        values: patch.values,
      });

      // Update contentEntry dipanggil
      expect(prisma.contentEntry.update).toHaveBeenCalled();

      // FieldValue di-rewrite untuk field yang diubah
      expect(prisma.fieldValue.deleteMany).toHaveBeenCalled();
      expect(prisma.fieldValue.create).toHaveBeenCalledWith({
        data: {
          entryId: "entry_1",
          fieldId: "field_title",
          valueString: "Updated Title",
        },
      });

      // Denorm hook
      expect(recomputeDenormForTargetChange).toHaveBeenCalledWith({
        workspaceId: "ws_1",
        targetEntryId: "entry_1",
      });

      expect(result.seoTitle).toBe("Updated Title");
    });
  });

  // =======================================================
  // listByContentTypeWithM2M (wiring ke repo)
  // =======================================================
  describe("listByContentTypeWithM2M()", () => {
    it("should resolve ContentType by apiKey and call findManyWithM2mRelated", async () => {
      prisma.contentType.findFirst.mockResolvedValueOnce({
        id: "ct_1",
      });

      findManyWithM2mRelated.mockResolvedValueOnce({
        rows: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

      const result = await contentEntryService.listByContentTypeWithM2M({
        workspaceId: "ws_1",
        contentTypeApiKey: "article",
        fieldId: "rel_tag",
        related: "entry_tag_1",
        page: 2,
        pageSize: 10,
      });

      expect(prisma.contentType.findFirst).toHaveBeenCalledWith({
        where: { workspaceId: "ws_1", apiKey: "article" },
        select: { id: true },
      });

      expect(findManyWithM2mRelated).toHaveBeenCalledWith({
        workspaceId: "ws_1",
        contentTypeId: "ct_1",
        fieldId: "rel_tag",
        related: "entry_tag_1",
        page: 2,
        pageSize: 10,
      });

      expect(result).toMatchObject({
        rows: [],
        total: 0,
      });
    });
  });
});
