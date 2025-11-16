// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ——————————————————————————————————
  // 0) Owner user (punya password beneran)
  // ——————————————————————————————————
  const plainPassword = "password_kamu"; // ← ini yang dipakai untuk login
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {
      name: "Owner Dev",
      passwordHash,
    },
    create: {
      email: "owner@example.com",
      name: "Owner Dev",
      status: "ACTIVE",
      passwordHash,
    },
  });

  // ——————————————————————————————————
  // 1) Workspace 'becms'
  // ——————————————————————————————————
  const ws = await prisma.workspace.upsert({
    where: { slug: "becms" },
    update: { name: "Demo Workspace", ownerId: owner.id },
    create: {
      name: "Demo Workspace",
      slug: "becms",
      ownerId: owner.id,
    },
  });

  // ——————————————————————————————————
  // 2) ContentTypes: author, brand, article
  // ——————————————————————————————————
  const ctAuthor = await prisma.contentType.upsert({
    where: { workspaceId_apiKey: { workspaceId: ws.id, apiKey: "author" } },
    update: {},
    create: {
      workspaceId: ws.id,
      name: "Author",
      apiKey: "author",
      description: "Author entries",
      visibility: "PUBLIC",
      seoEnabled: true,
    },
  });

  const ctBrand = await prisma.contentType.upsert({
    where: { workspaceId_apiKey: { workspaceId: ws.id, apiKey: "brand" } },
    update: {},
    create: {
      workspaceId: ws.id,
      name: "Brand Entry",
      apiKey: "brand",
      description: "Brand entries",
      visibility: "PUBLIC",
      seoEnabled: true,
    },
  });

  const ctArticle = await prisma.contentType.upsert({
    where: { workspaceId_apiKey: { workspaceId: ws.id, apiKey: "article" } },
    update: {},
    create: {
      workspaceId: ws.id,
      name: "Article",
      apiKey: "article",
      description: "Article posts",
      visibility: "PUBLIC",
      seoEnabled: true,
    },
  });

  // ——————————————————————————————————
  // 3) Fields untuk ARTICLE (lama)
  //     - title (TEXT, required)
  //     - author (RELATION -> ctAuthor, MANY_TO_ONE)
  //     - brand  (RELATION -> ctBrand,  MANY_TO_ONE)
  // ——————————————————————————————————
  const fldTitle = await prisma.contentField.upsert({
    where: { contentTypeId_apiKey: { contentTypeId: ctArticle.id, apiKey: "title" } },
    update: { name: "Title", type: "TEXT", isRequired: true, position: 1 },
    create: {
      contentTypeId: ctArticle.id,
      name: "Title",
      apiKey: "title",
      type: "TEXT",
      isRequired: true,
      position: 1,
    },
  });

  const fldAuthor = await prisma.contentField.upsert({
    where: { contentTypeId_apiKey: { contentTypeId: ctArticle.id, apiKey: "author" } },
    update: { name: "Author", type: "RELATION", position: 2 },
    create: {
      contentTypeId: ctArticle.id,
      name: "Author",
      apiKey: "author",
      type: "RELATION",
      position: 2,
    },
  });

  const fldBrand = await prisma.contentField.upsert({
    where: { contentTypeId_apiKey: { contentTypeId: ctArticle.id, apiKey: "brand" } },
    update: { name: "Brand", type: "RELATION", position: 3 },
    create: {
      contentTypeId: ctArticle.id,
      name: "Brand",
      apiKey: "brand",
      type: "RELATION",
      position: 3,
    },
  });

  // RelationConfig untuk field relasi lama
  await prisma.relationConfig.upsert({
    where: { fieldId: fldAuthor.id },
    update: { kind: "MANY_TO_ONE", targetContentTypeId: ctAuthor.id },
    create: {
      fieldId: fldAuthor.id,
      kind: "MANY_TO_ONE",
      targetContentTypeId: ctAuthor.id,
    },
  });

  await prisma.relationConfig.upsert({
    where: { fieldId: fldBrand.id },
    update: { kind: "MANY_TO_ONE", targetContentTypeId: ctBrand.id },
    create: {
      fieldId: fldBrand.id,
      kind: "MANY_TO_ONE",
      targetContentTypeId: ctBrand.id,
    },
  });

  // ——————————————————————————————————
  // 4) Seed entries basic: 1 author, 1 brand, 1 article (published)
  // ——————————————————————————————————
  const entAuthor = await prisma.contentEntry.upsert({
    where: { slug: "john-doe" },
    update: { seoTitle: "John Doe", isPublished: true, publishedAt: new Date() },
    create: {
      workspaceId: ws.id,
      contentTypeId: ctAuthor.id,
      slug: "john-doe",
      seoTitle: "John Doe",
      metaDescription: "Example author",
      keywords: ["author", "john"],
      isPublished: true,
      publishedAt: new Date(),
    },
  });

  const entBrand = await prisma.contentEntry.upsert({
    where: { slug: "sigma-store" },
    update: { seoTitle: "Sigma Store", isPublished: true, publishedAt: new Date() },
    create: {
      workspaceId: ws.id,
      contentTypeId: ctBrand.id,
      slug: "sigma-store",
      seoTitle: "Sigma Store",
      metaDescription: "Example brand",
      keywords: ["brand", "sigma"],
      isPublished: true,
      publishedAt: new Date(),
    },
  });

  const entArticle = await prisma.contentEntry.upsert({
    where: { slug: "hello-world" },
    update: {
      seoTitle: "Hello World",
      isPublished: true,
      publishedAt: new Date(),
    },
    create: {
      workspaceId: ws.id,
      contentTypeId: ctArticle.id,
      slug: "hello-world",
      seoTitle: "Hello World",
      metaDescription: "Contoh artikel demo",
      keywords: ["demo", "article"],
      isPublished: true,
      publishedAt: new Date(),
    },
  });

  // FieldValue: title untuk artikel
  await prisma.fieldValue.upsert({
    where: { entryId_fieldId: { entryId: entArticle.id, fieldId: fldTitle.id } },
    update: { valueString: "Hello World" },
    create: {
      entryId: entArticle.id,
      fieldId: fldTitle.id,
      valueString: "Hello World",
    },
  });

  // Relasi ARTICLE → AUTHOR
  await prisma.contentRelation.upsert({
    where: {
      fieldId_fromEntryId_toEntryId: {
        fieldId: fldAuthor.id,
        fromEntryId: entArticle.id,
        toEntryId: entAuthor.id,
      },
    },
    update: {},
    create: {
      workspaceId: ws.id,
      fieldId: fldAuthor.id,
      fromEntryId: entArticle.id,
      toEntryId: entAuthor.id,
      // position default 0 (boleh dikosongin karena default di schema)
    },
  });

  // Relasi ARTICLE → BRAND
  await prisma.contentRelation.upsert({
    where: {
      fieldId_fromEntryId_toEntryId: {
        fieldId: fldBrand.id,
        fromEntryId: entArticle.id,
        toEntryId: entBrand.id,
      },
    },
    update: {},
    create: {
      workspaceId: ws.id,
      fieldId: fldBrand.id,
      fromEntryId: entArticle.id,
      toEntryId: entBrand.id,
    },
  });

  // =====================================================================
  // 5) TAMBAHAN UNTUK TESTING POIN 1–4 (MULTI-DEPTH, O2M/M2O, M2M)
  // =====================================================================

  // 5.1 ContentType tambahan: category, tag
  const ctCategory = await prisma.contentType.upsert({
    where: { workspaceId_apiKey: { workspaceId: ws.id, apiKey: "category" } },
    update: {},
    create: {
      workspaceId: ws.id,
      name: "Category",
      apiKey: "category",
      description: "Article categories",
      visibility: "PUBLIC",
      seoEnabled: true,
    },
  });

  const ctTag = await prisma.contentType.upsert({
    where: { workspaceId_apiKey: { workspaceId: ws.id, apiKey: "tag" } },
    update: {},
    create: {
      workspaceId: ws.id,
      name: "Tag",
      apiKey: "tag",
      description: "Article tags",
      visibility: "PUBLIC",
      seoEnabled: true,
    },
  });

  // 5.2 Fields untuk CATEGORY:
  //     - name (TEXT)
  //     - parent (RELATION -> category, MANY_TO_ONE)
  const fldCategoryName = await prisma.contentField.upsert({
    where: { contentTypeId_apiKey: { contentTypeId: ctCategory.id, apiKey: "name" } },
    update: { name: "Name", type: "TEXT", isRequired: true, position: 1 },
    create: {
      contentTypeId: ctCategory.id,
      name: "Name",
      apiKey: "name",
      type: "TEXT",
      isRequired: true,
      position: 1,
    },
  });

  const fldCategoryParent = await prisma.contentField.upsert({
    where: { contentTypeId_apiKey: { contentTypeId: ctCategory.id, apiKey: "parent" } },
    update: { name: "Parent Category", type: "RELATION", position: 2 },
    create: {
      contentTypeId: ctCategory.id,
      name: "Parent Category",
      apiKey: "parent",
      type: "RELATION",
      position: 2,
    },
  });

  await prisma.relationConfig.upsert({
    where: { fieldId: fldCategoryParent.id },
    update: { kind: "MANY_TO_ONE", targetContentTypeId: ctCategory.id },
    create: {
      fieldId: fldCategoryParent.id,
      kind: "MANY_TO_ONE",
      targetContentTypeId: ctCategory.id,
    },
  });

  // 5.3 Fields tambahan di ARTICLE:
  //     - category (RELATION -> category, MANY_TO_ONE)
  //     - tags     (RELATION -> tag, MANY_TO_MANY)
  const fldArticleCategory = await prisma.contentField.upsert({
    where: { contentTypeId_apiKey: { contentTypeId: ctArticle.id, apiKey: "category" } },
    update: { name: "Category", type: "RELATION", position: 4 },
    create: {
      contentTypeId: ctArticle.id,
      name: "Category",
      apiKey: "category",
      type: "RELATION",
      position: 4,
    },
  });

  const fldArticleTags = await prisma.contentField.upsert({
    where: { contentTypeId_apiKey: { contentTypeId: ctArticle.id, apiKey: "tags" } },
    update: { name: "Tags", type: "RELATION", position: 5 },
    create: {
      contentTypeId: ctArticle.id,
      name: "Tags",
      apiKey: "tags",
      type: "RELATION",
      position: 5,
    },
  });

  await prisma.relationConfig.upsert({
    where: { fieldId: fldArticleCategory.id },
    update: { kind: "MANY_TO_ONE", targetContentTypeId: ctCategory.id },
    create: {
      fieldId: fldArticleCategory.id,
      kind: "MANY_TO_ONE",
      targetContentTypeId: ctCategory.id,
    },
  });

  await prisma.relationConfig.upsert({
    where: { fieldId: fldArticleTags.id },
    update: { kind: "MANY_TO_MANY", targetContentTypeId: ctTag.id },
    create: {
      fieldId: fldArticleTags.id,
      kind: "MANY_TO_MANY",
      targetContentTypeId: ctTag.id,
    },
  });

  // 5.4 Seed kategori: root → child → grandchild (buat depth test)
  const catRoot = await prisma.contentEntry.upsert({
    where: { slug: "root-category" },
    update: {
      seoTitle: "Root Category",
      isPublished: true,
      publishedAt: new Date(),
    },
    create: {
      workspaceId: ws.id,
      contentTypeId: ctCategory.id,
      slug: "root-category",
      seoTitle: "Root Category",
      metaDescription: "Root category",
      keywords: ["root", "category"],
      isPublished: true,
      publishedAt: new Date(),
    },
  });

  const catChild = await prisma.contentEntry.upsert({
    where: { slug: "child-category" },
    update: {
      seoTitle: "Child Category",
      isPublished: true,
      publishedAt: new Date(),
    },
    create: {
      workspaceId: ws.id,
      contentTypeId: ctCategory.id,
      slug: "child-category",
      seoTitle: "Child Category",
      metaDescription: "Child category",
      keywords: ["child", "category"],
      isPublished: true,
      publishedAt: new Date(),
    },
  });

  const catGrandchild = await prisma.contentEntry.upsert({
    where: { slug: "grandchild-category" },
    update: {
      seoTitle: "Grandchild Category",
      isPublished: true,
      publishedAt: new Date(),
    },
    create: {
      workspaceId: ws.id,
      contentTypeId: ctCategory.id,
      slug: "grandchild-category",
      seoTitle: "Grandchild Category",
      metaDescription: "Grandchild category",
      keywords: ["grandchild", "category"],
      isPublished: true,
      publishedAt: new Date(),
    },
  });

  // Value: name untuk kategori
  await prisma.fieldValue.upsert({
    where: { entryId_fieldId: { entryId: catRoot.id, fieldId: fldCategoryName.id } },
    update: { valueString: "Root Category" },
    create: {
      entryId: catRoot.id,
      fieldId: fldCategoryName.id,
      valueString: "Root Category",
    },
  });
  await prisma.fieldValue.upsert({
    where: { entryId_fieldId: { entryId: catChild.id, fieldId: fldCategoryName.id } },
    update: { valueString: "Child Category" },
    create: {
      entryId: catChild.id,
      fieldId: fldCategoryName.id,
      valueString: "Child Category",
    },
  });
  await prisma.fieldValue.upsert({
    where: { entryId_fieldId: { entryId: catGrandchild.id, fieldId: fldCategoryName.id } },
    update: { valueString: "Grandchild Category" },
    create: {
      entryId: catGrandchild.id,
      fieldId: fldCategoryName.id,
      valueString: "Grandchild Category",
    },
  });

  // Relasi CATEGORY → parent (self MANY_TO_ONE) untuk depth:
  // grandchild -> child, child -> root
  await prisma.contentRelation.upsert({
    where: {
      fieldId_fromEntryId_toEntryId: {
        fieldId: fldCategoryParent.id,
        fromEntryId: catChild.id,
        toEntryId: catRoot.id,
      },
    },
    update: {},
    create: {
      workspaceId: ws.id,
      fieldId: fldCategoryParent.id,
      fromEntryId: catChild.id,
      toEntryId: catRoot.id,
    },
  });

  await prisma.contentRelation.upsert({
    where: {
      fieldId_fromEntryId_toEntryId: {
        fieldId: fldCategoryParent.id,
        fromEntryId: catGrandchild.id,
        toEntryId: catChild.id,
      },
    },
    update: {},
    create: {
      workspaceId: ws.id,
      fieldId: fldCategoryParent.id,
      fromEntryId: catGrandchild.id,
      toEntryId: catChild.id,
    },
  });

  // 5.5 Relasi ARTICLE → CATEGORY (MANY_TO_ONE)
  await prisma.contentRelation.upsert({
    where: {
      fieldId_fromEntryId_toEntryId: {
        fieldId: fldArticleCategory.id,
        fromEntryId: entArticle.id,
        toEntryId: catGrandchild.id,
      },
    },
    update: {},
    create: {
      workspaceId: ws.id,
      fieldId: fldArticleCategory.id,
      fromEntryId: entArticle.id,
      toEntryId: catGrandchild.id,
    },
  });

  // 5.6 Seed TAGs + relasi M2M (ARTICLE → TAG)
  const tagCms = await prisma.contentEntry.upsert({
    where: { slug: "tag-cms" },
    update: {
      seoTitle: "CMS",
      isPublished: true,
      publishedAt: new Date(),
    },
    create: {
      workspaceId: ws.id,
      contentTypeId: ctTag.id,
      slug: "tag-cms",
      seoTitle: "CMS",
      metaDescription: "Tag CMS",
      keywords: ["cms"],
      isPublished: true,
      publishedAt: new Date(),
    },
  });

  const tagBackend = await prisma.contentEntry.upsert({
    where: { slug: "tag-backend" },
    update: {
      seoTitle: "Backend",
      isPublished: true,
      publishedAt: new Date(),
    },
    create: {
      workspaceId: ws.id,
      contentTypeId: ctTag.id,
      slug: "tag-backend",
      seoTitle: "Backend",
      metaDescription: "Tag Backend",
      keywords: ["backend"],
      isPublished: true,
      publishedAt: new Date(),
    },
  });

  // Relasi M2M: ARTICLE "hello-world" memiliki dua tag: [cms, backend]
  // (position default 0; kalau mau tes reorder, nanti via endpoint PATCH)
  await prisma.contentRelationM2M.upsert({
    where: {
      uniq_m2m_rel_triple: {
        relationFieldId: fldArticleTags.id,
        fromEntryId: entArticle.id,
        toEntryId: tagCms.id,
      },
    },
    update: {},
    create: {
      workspaceId: ws.id,
      relationFieldId: fldArticleTags.id,
      fromEntryId: entArticle.id,
      toEntryId: tagCms.id,
      // position default 0 di schema
    },
  });

  await prisma.contentRelationM2M.upsert({
    where: {
      uniq_m2m_rel_triple: {
        relationFieldId: fldArticleTags.id,
        fromEntryId: entArticle.id,
        toEntryId: tagBackend.id,
      },
    },
    update: {},
    create: {
      workspaceId: ws.id,
      relationFieldId: fldArticleTags.id,
      fromEntryId: entArticle.id,
      toEntryId: tagBackend.id,
    },
  });

  console.log("✅ Seed selesai. Workspace:", ws.slug);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
