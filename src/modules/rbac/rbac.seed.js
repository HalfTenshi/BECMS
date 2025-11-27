// src/modules/rbac/rbac.seed.js
import prisma from "../../config/prismaClient.js";
import { ACTIONS, MODULE_KEYS } from "./rbac.constants.js";

// ---------------------------------------------------------------
// ROLE CONFIG
// ---------------------------------------------------------------
export const ROLE_KEYS = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
  SEO_SPECIALIST: "SEO_SPECIALIST",
};

// Semua permission yang mau dibuat (per workspace)
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
  [ROLE_KEYS.OWNER]: "ALL", // khusus: dapat semua permission di workspace tsb

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

    { module: MODULE_KEYS.ASSETS, actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE] },
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

    { module: MODULE_KEYS.ASSETS, actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE] },
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
// INTERNAL HELPERS
// ---------------------------------------------------------------

async function upsertPermissions(workspaceId) {
  if (!workspaceId) {
    throw new Error("workspaceId is required in upsertPermissions");
  }

  const map = {};

  await Promise.all(
    PERMISSION_DEFINITIONS.map(async (def) => {
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

      map[key] = perm;
    })
  );

  return map; // { "USERS:READ": Permission, ... }
}

async function upsertRoles(workspaceId) {
  if (!workspaceId) {
    throw new Error("workspaceId is required in upsertRoles");
  }

  const map = {};

  await Promise.all(
    Object.values(ROLE_KEYS).map(async (roleName) => {
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

      map[roleName] = role;
    })
  );

  return map; // { OWNER: Role, ADMIN: Role, ... }
}

async function upsertRolePermissions(workspaceId, rolesByKey, permissionsByKey) {
  if (!workspaceId) {
    throw new Error("workspaceId is required in upsertRolePermissions");
  }

  for (const [roleName, rule] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    const role = rolesByKey[roleName];
    if (!role) continue;

    // OWNER: semua permission di workspace tsb
    if (rule === "ALL") {
      await Promise.all(
        Object.values(permissionsByKey).map((perm) =>
          prisma.rolePermission.upsert({
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
          })
        )
      );
      continue;
    }

    // Role lain: mapping spesifik
    for (const entry of rule) {
      for (const action of entry.actions) {
        const key = `${entry.module}:${action}`;
        const perm = permissionsByKey[key];
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

// ---------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------

/**
 * Seed default roles & permissions untuk satu workspace.
 * Dipanggil dari prisma/seed.js dengan:
 *   await ensureDefaultRolesAndPermissions(ws.id);
 */
export async function ensureDefaultRolesAndPermissions(workspaceId) {
  if (!workspaceId) {
    throw new Error("workspaceId is required in ensureDefaultRolesAndPermissions");
  }

  const [permissionsByKey, rolesByKey] = await Promise.all([
    upsertPermissions(workspaceId),
    upsertRoles(workspaceId),
  ]);

  await upsertRolePermissions(workspaceId, rolesByKey, permissionsByKey);

  // kalau mau dipakai lagi, fungsi ini mengembalikan mapping
  return { permissionsByKey, rolesByKey };
}

/**
 * Dipakai saat create workspace dari service:
 * - Pastikan roles & permissions default sudah ada untuk workspace itu
 * - Pastikan workspaceMember (workspaceId, userId) ada
 * - Set ownerId di workspace (kalau belum)
 * - Assign role OWNER ke member tsb
 *
 * Digunakan dari: workspace.service.js
 */
export async function ensureWorkspaceDefaultRoleBinding(workspaceId, userId) {
  if (!workspaceId || !userId) {
    throw new Error("workspaceId and userId are required in ensureWorkspaceDefaultRoleBinding");
  }

  // 1) Pastikan RBAC (roles & permissions) sudah ada
  const { rolesByKey } = await ensureDefaultRolesAndPermissions(workspaceId);

  // 2) Pastikan workspaceMember ada
  const member = await prisma.workspaceMember.upsert({
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

  // 3) Update workspace.ownerId kalau belum terisi
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true },
  });

  if (workspace && !workspace.ownerId) {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { ownerId: userId },
    });
  }

  // 4) Assign role OWNER ke member tsb
  const ownerRole = rolesByKey[ROLE_KEYS.OWNER];
  if (ownerRole) {
    await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: {
        roleId: ownerRole.id,
      },
    });
  }

  return {
    workspaceMemberId: member.id,
    roleId: ownerRole ? ownerRole.id : null,
  };
}
