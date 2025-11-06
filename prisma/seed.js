// prisma/seed.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // ——————————————————————————————————
  // 0) Owner user (minimal, tanpa password)
  // ——————————————————————————————————
  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: { name: "Owner Dev" },
    create: {
      email: "owner@example.com",
      name: "Owner Dev",
      status: "ACTIVE",
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
  // 3) Fields untuk ARTICLE
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

  // RelationConfig untuk field relasi
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
  // 4) Seed entries: 1 author, 1 brand, 1 article (published)
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

  console.log("✅ Seed selesai. Workspace:", ws.slug);
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
