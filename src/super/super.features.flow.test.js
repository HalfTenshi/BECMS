// =========================================================
// src/super/super.features.flow.test.js
// =========================================================
//
// SUPER TEST / ACCEPTANCE TEST PBL 2025
// - Pakai Prisma real DB (BUKAN mock)
// - Cover fitur utama:
//   1) Auth register
//   2) Workspace + RBAC default (Owner, roles & permissions)
//   3) Plan + enforcePlanLimit (limit member)
//   4) ContentType + ContentField
//   5) ContentEntry + SEO + slug unique
//   6) Relations.expander (RELATION field)
//   7) Subscription.getWorkspacePlanStatus (plan + subscription + usage)
//   8) SEO Support analyze() (title/desc/slug/keyword checks + score)
//
// CATATAN:
// - Pastikan DATABASE_URL mengarah ke DB yang aman untuk test.
// - File ini sengaja tidak mock prisma, supaya benar-benar
//   ngetes alur nyata di backend BECMS.
// =========================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";

import prisma from "../config/prismaClient.js";

import authService from "../modules/auth/auth.service.js";
import workspaceMemberService from "../modules/workspace/member.service.js";
import contentTypeService from "../modules/content/contentType.service.js";
import contentFieldService from "../modules/content/contentField.service.js";
import contentEntryService from "../modules/content/contentEntry.service.js";
import seoSupportService from "../modules/seo/seoSupport.service.js";
import subscriptionService from "../modules/subscription/subscription.service.js";
import { expandRelations } from "../modules/content/relations.expander.js";
import { ensureWorkspaceDefaultRoleBinding } from "../modules/rbac/rbac.seed.js";
import { ApiError } from "../utils/ApiError.js";
import { ERROR_CODES } from "../constants/errorCodes.js";
import {
  MAX_SEO_TITLE_LENGTH,
  MAX_META_DESCRIPTION_LENGTH,
} from "../utils/seoUtils.js";

describe("SUPER FEATURE FLOW - BECMS PBL 2025", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it(
    "should cover Auth + RBAC + Plan Limit + Content Model + Content Entry + SEO + Relations + Subscription in one scenario",
    async () => {
      const now = Date.now();
      const suffix = `super_${now}`;

      const ownerEmail = `owner+${suffix}@example.com`;
      const editorEmail = `editor+${suffix}@example.com`;
      const workspaceSlug = `ws_${suffix}`;
      const planName = `SUPER_TEST_PLAN_${suffix}`;

      // -------------------------------------------------------------------
      // 1) AUTH: register owner (user pertama)
      // -------------------------------------------------------------------
      const ownerAuth = await authService.register({
        name: "Owner SuperTest",
        email: ownerEmail,
        password: "Password123!",
      });

      expect(ownerAuth.user).toBeDefined();
      expect(ownerAuth.user.id).toBeTruthy();
      expect(ownerAuth.token).toBeTruthy();

      // -------------------------------------------------------------------
      // 2) PLAN: buat plan dengan limit ketat
      //    - maxMembers = 1
      //    - maxContentTypes = 2
      //    - maxEntries = 3
      // -------------------------------------------------------------------
      const plan = await prisma.plan.create({
        data: {
          name: planName,
          monthlyPrice: 0,
          yearlyPrice: 0,
          maxMembers: 1,
          maxContentTypes: 2,
          maxEntries: 3,
        },
      });

      expect(plan.id).toBeTruthy();

      // -------------------------------------------------------------------
      // 3) WORKSPACE: buat workspace & tautkan ke owner + plan
      // -------------------------------------------------------------------
      const workspace = await prisma.workspace.create({
        data: {
          name: `Workspace SuperTest ${suffix}`,
          slug: workspaceSlug,
          ownerId: ownerAuth.user.id,
          planId: plan.id,
        },
      });

      expect(workspace.id).toBeTruthy();

      // -------------------------------------------------------------------
      // 4) RBAC: seed roles & permissions + jadikan owner sebagai OWNER
      // -------------------------------------------------------------------
      const rbacResult = await ensureWorkspaceDefaultRoleBinding(
        workspace.id,
        ownerAuth.user.id
      );

      expect(rbacResult.workspaceMemberId).toBeTruthy();

      const ownerMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: workspace.id,
          userId: ownerAuth.user.id,
        },
        include: { role: true },
      });

      expect(ownerMember).toBeTruthy();
      expect(ownerMember.role).toBeTruthy();
      expect(ownerMember.role.name).toBe("OWNER");

      // -------------------------------------------------------------------
      // 5) AUTH: register editor user (user kedua)
      // -------------------------------------------------------------------
      const editorAuth = await authService.register({
        name: "Editor SuperTest",
        email: editorEmail,
        password: "Password123!",
      });

      expect(editorAuth.user).toBeDefined();

      // Ambil role EDITOR di workspace ini
      const editorRole = await prisma.role.findUnique({
        where: {
          workspaceId_name: {
            workspaceId: workspace.id,
            name: "EDITOR",
          },
        },
      });

      expect(editorRole).toBeTruthy();

      // -------------------------------------------------------------------
      // 6) PLAN LIMIT: coba add member ke-2 dan HARUS kena PLAN_LIMIT_MEMBERS
      // -------------------------------------------------------------------
      await expect(
        workspaceMemberService.add(workspace.id, {
          userId: editorAuth.user.id,
          roleId: editorRole.id,
        })
      ).rejects.toBeInstanceOf(ApiError);

      await expect(
        workspaceMemberService.add(workspace.id, {
          userId: editorAuth.user.id,
          roleId: editorRole.id,
        })
      ).rejects.toMatchObject({
        status: 403,
        code: ERROR_CODES.PLAN_LIMIT_MEMBERS,
        reason: ERROR_CODES.PLAN_LIMIT_EXCEEDED,
      });

      // Pastikan tetap hanya 1 member (OWNER) di workspace ini
      const memberCount = await prisma.workspaceMember.count({
        where: { workspaceId: workspace.id },
      });
      expect(memberCount).toBe(1);

      // -------------------------------------------------------------------
      // 7) CONTENT MODEL:
      //    Buat 2 ContentType:
      //    - Category  (seoEnabled=false)
      //    - BlogPost  (seoEnabled=true)
      // -------------------------------------------------------------------
      const categoryCT = await contentTypeService.create(
        {
          name: "Category",
          apiKey: `Category_${suffix}`,
          description: "Test category model",
          seoEnabled: false,
        },
        workspace.id
      );

      const postCT = await contentTypeService.create(
        {
          name: "Blog Post",
          apiKey: `BlogPost_${suffix}`,
          description: "Test blog post model",
          seoEnabled: true,
        },
        workspace.id
      );

      expect(categoryCT.id).toBeTruthy();
      expect(postCT.id).toBeTruthy();

      // -------------------------------------------------------------------
      // 8) CONTENT FIELD:
      //    - Category: categoryName (TEXT, required)
      //    - BlogPost: title (TEXT, required)
      //               body (RICH_TEXT)
      //               category (RELATION MANY_TO_ONE → Category)
      // -------------------------------------------------------------------
      const categoryNameField = await contentFieldService.create({
        contentTypeId: categoryCT.id,
        workspaceId: workspace.id,
        payload: {
          name: "Category Name",
          apiKey: "categoryName",
          type: "TEXT",
          isRequired: true,
        },
      });

      const titleField = await contentFieldService.create({
        contentTypeId: postCT.id,
        workspaceId: workspace.id,
        payload: {
          name: "Title",
          apiKey: "title",
          type: "TEXT",
          isRequired: true,
        },
      });

      const bodyField = await contentFieldService.create({
        contentTypeId: postCT.id,
        workspaceId: workspace.id,
        payload: {
          name: "Body",
          apiKey: "body",
          type: "RICH_TEXT",
        },
      });

      const categoryRelField = await contentFieldService.create({
        contentTypeId: postCT.id,
        workspaceId: workspace.id,
        payload: {
          name: "Category",
          apiKey: "category",
          type: "RELATION",
          relation: {
            kind: "MANY_TO_ONE",
            targetContentTypeId: categoryCT.id,
          },
          config: {
            minCount: 1,
            maxCount: 1,
          },
        },
      });

      expect(categoryNameField.id).toBeTruthy();
      expect(titleField.id).toBeTruthy();
      expect(bodyField.id).toBeTruthy();
      expect(categoryRelField.id).toBeTruthy();

      // -------------------------------------------------------------------
      // 9) CONTENT ENTRY: buat 1 Category (seoEnabled=false)
      //    → SEO fields diisi tapi HARUS di-null-kan di DB
      // -------------------------------------------------------------------
      const categoryEntry = await contentEntryService.create({
        workspaceId: workspace.id,
        contentTypeId: categoryCT.id,
        values: [{ apiKey: "categoryName", value: "Technology" }],
        seoTitle: "Should NOT be stored",
        metaDescription: "This should be ignored because seoEnabled=false",
        keywords: ["ignored"],
        isPublished: true,
        createdById: ownerAuth.user.id,
      });

      expect(categoryEntry.id).toBeTruthy();
      expect(categoryEntry.slug).toBeTruthy();

      expect(categoryEntry.seoTitle).toBeNull();
      expect(categoryEntry.metaDescription).toBeNull();
      expect(Array.isArray(categoryEntry.keywords)).toBe(true);
      expect(categoryEntry.keywords.length).toBe(0);

      // -------------------------------------------------------------------
      // 10) CONTENT ENTRY: buat 1 BlogPost (seoEnabled=true) + RELATION ke Category
      // -------------------------------------------------------------------
      const seoTitle = "Hello World Super Test";
      const seoDesc = "Short meta description for super test blog post.";

      const postEntry = await contentEntryService.create({
        workspaceId: workspace.id,
        contentTypeId: postCT.id,
        values: [
          { apiKey: "title", value: "Hello World Super Test" },
          {
            apiKey: "body",
            value: "This is the body for the super test blog post.",
          },
          {
            apiKey: "category",
            value: categoryEntry.id,
          },
        ],
        seoTitle,
        metaDescription: seoDesc,
        keywords: ["super", "test", "blog"],
        isPublished: true,
        createdById: ownerAuth.user.id,
      });

      expect(postEntry.id).toBeTruthy();
      expect(postEntry.slug).toBeTruthy();
      expect(postEntry.seoTitle).toBe(seoTitle);
      expect(postEntry.metaDescription).toBe(seoDesc);
      expect(postEntry.keywords).toEqual(["super", "test", "blog"]);

      // -------------------------------------------------------------------
      // 11) CONTENT ENTRY: cek SLUG unik per (workspace, contentType)
      // -------------------------------------------------------------------
      await expect(
        contentEntryService.create({
          workspaceId: workspace.id,
          contentTypeId: postCT.id,
          slug: postEntry.slug,
          values: [{ apiKey: "title", value: "Another post with same slug" }],
          isPublished: true,
          createdById: ownerAuth.user.id,
        })
      ).rejects.toMatchObject({
        status: 409,
        code: ERROR_CODES.SLUG_CONFLICT,
      });

      // -------------------------------------------------------------------
      // 12) RELATIONS: expandRelations untuk BlogPost
      // -------------------------------------------------------------------
      const relationsMap = await expandRelations({
        workspaceId: workspace.id,
        entries: [{ id: postEntry.id }],
        contentTypeId: postCT.id,
        depth: 1,
        mode: "basic",
      });

      expect(relationsMap).toBeInstanceOf(Map);

      const expanded = relationsMap.get(postEntry.id);
      expect(expanded).toBeDefined();
      expect(expanded.category).toBeDefined();
      expect(expanded.category.id).toBe(categoryEntry.id);

      // -------------------------------------------------------------------
      // 13) SUBSCRIPTION: buat 1 Subscription ACTIVE & cek plan status + usage
      // -------------------------------------------------------------------
      const subscription = await prisma.subscription.create({
        data: {
          workspaceId: workspace.id,
          planId: plan.id,
          status: "ACTIVE",
          startedAt: new Date(),
        },
      });

      expect(subscription.id).toBeTruthy();

      const status = await subscriptionService.getWorkspacePlanStatus(
        workspace.id
      );

      expect(status.workspace.id).toBe(workspace.id);
      expect(status.plan).not.toBeNull();
      expect(status.plan.name).toBe(plan.name);

      expect(status.usage.members.current).toBe(1);
      expect(status.usage.contentTypes.current).toBe(2);
      expect(status.usage.entries.current).toBe(2);

      expect(status.subscription).not.toBeNull();
      expect(status.subscription.status).toBe("ACTIVE");
      expect(status.subscription.planId).toBe(plan.id);

      // -------------------------------------------------------------------
      // 14) SEO SUPPORT: analyze() sesuai struktur asli service test kamu
      // -------------------------------------------------------------------
      const seoResult = await seoSupportService.analyze({
        title: seoTitle,
        description: seoDesc,
        slug: postEntry.slug,
        content: "This is the body for the super test blog post.",
        focusKeyword: "super",
      });

      // Shape result mengikuti unit test yang sudah PASS:
      // result.title: { length, max, status }
      // result.description: { length, max, status }
      // result.keyword: { value, inTitle, inSlug, inDescription }
      // result.score.overall: number 0..100
      expect(seoResult.title.length).toBe(seoTitle.length);
      expect(seoResult.title.max).toBe(MAX_SEO_TITLE_LENGTH);
      expect(["ok", "too_long", "too_short", "empty"]).toContain(
        seoResult.title.status
      );

      expect(seoResult.description.length).toBe(seoDesc.length);
      expect(seoResult.description.max).toBe(MAX_META_DESCRIPTION_LENGTH);
      expect(["ok", "too_long", "too_short", "empty"]).toContain(
        seoResult.description.status
      );

      expect(seoResult.keyword.value).toBe("super");
      expect(typeof seoResult.keyword.inTitle).toBe("boolean");
      expect(typeof seoResult.keyword.inSlug).toBe("boolean");
      expect(typeof seoResult.keyword.inDescription).toBe("boolean");

      // inSlug harus true karena slug = postEntry.slug mengandung kata "super"?
      // Untuk aman: kita cek konsistensi logika keyword-in-slug secara case-insensitive
      // (Kalau slug kebetulan tidak mengandung "super", test tidak akan false-negative)
      const slugLower = String(postEntry.slug || "").toLowerCase();
      if (slugLower.includes("super")) {
        expect(seoResult.keyword.inSlug).toBe(true);
      }

      expect(seoResult.score.overall).toBeGreaterThanOrEqual(0);
      expect(seoResult.score.overall).toBeLessThanOrEqual(100);
      expect(seoResult.score.breakdown).toBeTruthy();
      expect(Array.isArray(seoResult.score.breakdown.penalties)).toBe(true);
      expect(Array.isArray(seoResult.score.breakdown.bonuses)).toBe(true);
    }
  );
});
