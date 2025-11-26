// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Import ACTIONS & MODULE_KEYS dari permissions.js
import { ACTIONS, MODULE_KEYS } from "../src/constants/permissions.js";

const prisma = new PrismaClient();

// ---------------------------------------------------------------
// ROLE & PERMISSION CONFIG
// ---------------------------------------------------------------

const ROLE_KEYS = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
  SEO_SPECIALIST: "SEO_SPECIALIST",
};

// Semua permission yang mau dibuat
const PERMISSION_DEFINITIONS = [
  // USERS
  { module: MODULE_KEYS.USERS, action: ACTIONS.CREATE },
  { module: MODULE_KEYS.USERS, action: ACTIONS.READ },
  { module: MODULE_KEYS.USERS, action: ACTIONS.UPDATE },
  { module: MODULE_KEYS.USERS, action: ACTIONS.DELETE },

  // WORKSPACES
  { module: MODULE_KEYS.WORKSPACES, action: ACTIONS.READ },
  { module: MODULE_KEYS.WORKSPACES, action: ACTIONS.UPDATE },

  // ROLES & PERMISSIONS
  { module: MODULE_KEYS.ROLES, action: ACTIONS.CREATE },
  { module: MODULE_KEYS.ROLES, action: ACTIONS.READ },
  { module: MODULE_KEYS.ROLES, action: ACTIONS.UPDATE },
  { module: MODULE_KEYS.ROLES, action: ACTIONS.DELETE },

  { module: MODULE_KEYS.PERMISSIONS, action: ACTIONS.READ },

  // CONTENT TYPES
  { module: MODULE_KEYS.CONTENT_TYPES, action: ACTIONS.CREATE },
  { module: MODULE_KEYS.CONTENT_TYPES, action: ACTIONS.READ },
  { module: MODULE_KEYS.CONTENT_TYPES, action: ACTIONS.UPDATE },
  { module: MODULE_KEYS.CONTENT_TYPES, action: ACTIONS.DELETE },

  // CONTENT FIELDS
  { module: MODULE_KEYS.CONTENT_FIELDS, action: ACTIONS.CREATE },
  { module: MODULE_KEYS.CONTENT_FIELDS, action: ACTIONS.READ },
  { module: MODULE_KEYS.CONTENT_FIELDS, action: ACTIONS.UPDATE },
  { module: MODULE_KEYS.CONTENT_FIELDS, action: ACTIONS.DELETE },

  // CONTENT ENTRIES
  { module: MODULE_KEYS.CONTENT_ENTRIES, action: ACTIONS.CREATE },
  { module: MODULE_KEYS.CONTENT_ENTRIES, action: ACTIONS.READ },
  { module: MODULE_KEYS.CONTENT_ENTRIES, action: ACTIONS.UPDATE },
  { module: MODULE_KEYS.CONTENT_ENTRIES, action: ACTIONS.DELETE },
  { module: MODULE_KEYS.CONTENT_ENTRIES, action: ACTIONS.PUBLISH },

  // CONTENT RELATIONS
  { module: MODULE_KEYS.CONTENT_RELATIONS, action: ACTIONS.READ },
  { module: MODULE_KEYS.CONTENT_RELATIONS, action: ACTIONS.UPDATE },

  // CONTENT SEO
  { module: MODULE_KEYS.CONTENT_SEO, action: ACTIONS.READ },
  { module: MODULE_KEYS.CONTENT_SEO, action: ACTIONS.UPDATE },

  // PLANS
  { module: MODULE_KEYS.PLANS, action: ACTIONS.CREATE },
  { module: MODULE_KEYS.PLANS, action: ACTIONS.READ },
  { module: MODULE_KEYS.PLANS, action: ACTIONS.UPDATE },
  { module: MODULE_KEYS.PLANS, action: ACTIONS.DELETE },

  // PRODUCTS
  { module: MODULE_KEYS.PRODUCTS, action: ACTIONS.CREATE },
  { module: MODULE_KEYS.PRODUCTS, action: ACTIONS.READ },
  { module: MODULE_KEYS.PRODUCTS, action: ACTIONS.UPDATE },
  { module: MODULE_KEYS.PRODUCTS, action: ACTIONS.DELETE },

  // BRANDS
  { module: MODULE_KEYS.BRANDS, action: ACTIONS.CREATE },
  { module: MODULE_KEYS.BRANDS, action: ACTIONS.READ },
  { module: MODULE_KEYS.BRANDS, action: ACTIONS.UPDATE },
  { module: MODULE_KEYS.BRANDS, action: ACTIONS.DELETE },

  // ASSETS & UPLOADS
  { module: MODULE_KEYS.ASSETS, action: ACTIONS.CREATE },
  { module: MODULE_KEYS.ASSETS, action: ACTIONS.READ },
  { module: MODULE_KEYS.ASSETS, action: ACTIONS.UPDATE },
  { module: MODULE_KEYS.ASSETS, action: ACTIONS.DELETE },

  { module: MODULE_KEYS.UPLOADS, action: ACTIONS.CREATE },
  { module: MODULE_KEYS.UPLOADS, action: ACTIONS.READ },
  { module: MODULE_KEYS.UPLOADS, action: ACTIONS.DELETE },
];

// Role → permission matrix
const ROLE_PERMISSION_MATRIX = {
  [ROLE_KEYS.OWNER]: "ALL", // khusus: dapat semua

  [ROLE_KEYS.ADMIN]: [
    { module: MODULE_KEYS.USERS, actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE] },
    { module: MODULE_KEYS.WORKSPACES, actions: [ACTIONS.READ, ACTIONS.UPDATE] },
    { module: MODULE_KEYS.ROLES, actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE] },
    { module: MODULE_KEYS.PERMISSIONS, actions: [ACTIONS.READ] },

    { module: MODULE_KEYS.CONTENT_TYPES, actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE] },
    { module: MODULE_KEYS.CONTENT_FIELDS, actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE] },
    {
      module: MODULE_KEYS.CONTENT_ENTRIES,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.PUBLISH],
    },
    { module: MODULE_KEYS.CONTENT_RELATIONS, actions: [ACTIONS.READ, ACTIONS.UPDATE] },
    { module: MODULE_KEYS.CONTENT_SEO, actions: [ACTIONS.READ, ACTIONS.UPDATE] },

    { module: MODULE_KEYS.PLANS, actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE] },

    { module: MODULE_KEYS.PRODUCTS, actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE] },
    { module: MODULE_KEYS.BRANDS, actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE] },

    {
      module: MODULE_KEYS.ASSETS,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE],
    },
    { module: MODULE_KEYS.UPLOADS, actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.DELETE] },
  ],

  [ROLE_KEYS.EDITOR]: [
    { module: MODULE_KEYS.CONTENT_TYPES, actions: [ACTIONS.READ] },
    { module: MODULE_KEYS.CONTENT_FIELDS, actions: [ACTIONS.READ] },

    {
      module: MODULE_KEYS.CONTENT_ENTRIES,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.PUBLISH],
    },
    { module: MODULE_KEYS.CONTENT_RELATIONS, actions: [ACTIONS.READ, ACTIONS.UPDATE] },
    { module: MODULE_KEYS.CONTENT_SEO, actions: [ACTIONS.READ, ACTIONS.UPDATE] },

    {
      module: MODULE_KEYS.ASSETS,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE],
    },
    { module: MODULE_KEYS.UPLOADS, actions: [ACTIONS.CREATE, ACTIONS.READ] },
  ],

  [ROLE_KEYS.VIEWER]: [
    { module: MODULE_KEYS.CONTENT_TYPES, actions: [ACTIONS.READ] },
    { module: MODULE_KEYS.CONTENT_FIELDS, actions: [ACTIONS.READ] },
    { module: MODULE_KEYS.CONTENT_ENTRIES, actions: [ACTIONS.READ] },
    { module: MODULE_KEYS.CONTENT_RELATIONS, actions: [ACTIONS.READ] },
    { module: MODULE_KEYS.CONTENT_SEO, actions: [ACTIONS.READ] },
    { module: MODULE_KEYS.ASSETS, actions: [ACTIONS.READ] },
  ],

  [ROLE_KEYS.SEO_SPECIALIST]: [
    { module: MODULE_KEYS.CONTENT_TYPES, actions: [ACTIONS.READ] },
    { module: MODULE_KEYS.CONTENT_FIELDS, actions: [ACTIONS.READ] },

    { module: MODULE_KEYS.CONTENT_ENTRIES, actions: [ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.PUBLISH] },
    { module: MODULE_KEYS.CONTENT_SEO, actions: [ACTIONS.READ, ACTIONS.UPDATE] },

    { module: MODULE_KEYS.ASSETS, actions: [ACTIONS.READ] },
  ],
};

// ---------------------------------------------------------------
// HELPER RBAC
// ---------------------------------------------------------------

async function upsertWorkspaceMember(workspaceId, userId) {
  // sesuai @@unique([workspaceId, userId])
  return prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    update: {},
    create: {
      workspaceId,
      userId,
    },
  });
}

async function seedPermissions(workspaceId) {
  const permissionRecords = {};

  for (const def of PERMISSION_DEFINITIONS) {
    const key = `${def.module}:${def.action}`;

    const perm = await prisma.permission.upsert({
      where: {
        workspaceId_module_action: {
          workspaceId,
          module: def.module,
          action: def.action,
        },
      },
      update: {},
      create: {
        workspaceId,
        module: def.module,
        action: def.action,
        name: key,
        description: `${def.action} on ${def.module}`,
      },
    });

    permissionRecords[key] = perm;
  }

  return permissionRecords;
}

async function seedRoles(workspaceId) {
  const roleRecords = {};

  for (const roleName of Object.values(ROLE_KEYS)) {
    const role = await prisma.role.upsert({
      where: {
        workspaceId_name: {
          workspaceId,
          name: roleName,
        },
      },
      update: {},
      create: {
        workspaceId,
        name: roleName,
        description: `${roleName} role`,
      },
    });

    roleRecords[roleName] = role;
  }

  return roleRecords;
}

async function seedRolePermissions(workspaceId, roles, permissionsMap) {
  for (const [roleName, rule] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    const role = roles[roleName];
    if (!role) continue;

    if (rule === "ALL") {
      for (const perm of Object.values(permissionsMap)) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }
      continue;
    }

    for (const entry of rule) {
      for (const action of entry.actions) {
        const key = `${entry.module}:${action}`;
        const perm = permissionsMap[key];
        if (!perm) continue;

        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }
    }
  }
}

async function attachOwnerRoleToMember(roles, workspace, user) {
  const ownerRole = roles[ROLE_KEYS.OWNER];
  if (!ownerRole) return;

  // Kalau schema workspace punya ownerId:
  try {
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { ownerId: user.id },
    });
  } catch (e) {
    // kalau tidak ada field ownerId, aman di-skip
  }

  // Update WorkspaceMember → set role OWNER
  await prisma.workspaceMember.update({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    data: {
      roleId: ownerRole.id,
    },
  });
}

// ---------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------

async function main() {
  // ——————————————————————————————————
  // 0) Owner user (punya password beneran)
  // ——————————————————————————————————
  const plainPassword = "password_kamu"; // TODO: ganti di env / jangan commit ke production
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
  // 1.1) RBAC untuk workspace + owner
  // ——————————————————————————————————
  await upsertWorkspaceMember(ws.id, owner.id);
  const permissionsMap = await seedPermissions(ws.id);
  const roles = await seedRoles(ws.id);
  await seedRolePermissions(ws.id, roles, permissionsMap);
  await attachOwnerRoleToMember(roles, ws, owner);

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
    where: {
      workspaceId_contentTypeId_slug: {
        workspaceId: ws.id,
        contentTypeId: ctAuthor.id,
        slug: "john-doe",
      },
    },
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
    where: {
      workspaceId_contentTypeId_slug: {
        workspaceId: ws.id,
        contentTypeId: ctBrand.id,
        slug: "sigma-store",
      },
    },
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
    where: {
      workspaceId_contentTypeId_slug: {
        workspaceId: ws.id,
        contentTypeId: ctArticle.id,
        slug: "hello-world",
      },
    },
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

  // =====================================================================
  // 5) Tambahan untuk testing multi-depth & M2M
  // =====================================================================

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

  const catRoot = await prisma.contentEntry.upsert({
    where: {
      workspaceId_contentTypeId_slug: {
        workspaceId: ws.id,
        contentTypeId: ctCategory.id,
        slug: "root-category",
      },
    },
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
    where: {
      workspaceId_contentTypeId_slug: {
        workspaceId: ws.id,
        contentTypeId: ctCategory.id,
        slug: "child-category",
      },
    },
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
    where: {
      workspaceId_contentTypeId_slug: {
        workspaceId: ws.id,
        contentTypeId: ctCategory.id,
        slug: "grandchild-category",
      },
    },
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

  const tagCms = await prisma.contentEntry.upsert({
    where: {
      workspaceId_contentTypeId_slug: {
        workspaceId: ws.id,
        contentTypeId: ctTag.id,
        slug: "tag-cms",
      },
    },
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
    where: {
      workspaceId_contentTypeId_slug: {
        workspaceId: ws.id,
        contentTypeId: ctTag.id,
        slug: "tag-backend",
      },
    },
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
