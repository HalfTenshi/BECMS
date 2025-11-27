// src/services/planLimit.service.js
import prisma from "../config/prismaClient.js";

/**
 * Action yang dikenali oleh enforcePlanLimit.
 * Bisa kamu pakai di service lain biar konsisten.
 */
export const PLAN_LIMIT_ACTIONS = {
  ADD_MEMBER: "ADD_MEMBER",
  ADD_CONTENT_TYPE: "ADD_CONTENT_TYPE",
  ADD_ENTRY: "ADD_ENTRY",
};

/**
 * Ambil limit plan untuk workspace tertentu.
 * - Workspace.planId -> Plan.maxMembers / maxContentTypes / maxEntries
 * - Jika workspace tidak punya plan, atau limit null => dianggap unlimited.
 */
async function getWorkspacePlanLimits(workspaceId) {
  if (!workspaceId) {
    const e = new Error("workspaceId is required");
    e.status = 400;
    throw e;
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      plan: {
        select: {
          id: true,
          name: true,
          maxMembers: true,
          maxContentTypes: true,
          maxEntries: true,
        },
      },
    },
  });

  if (!ws) {
    const e = new Error("Workspace not found");
    e.status = 404;
    throw e;
  }

  // Kalau belum ada plan terpasang, treat as unlimited (free dev mode)
  if (!ws.plan) {
    return {
      planId: null,
      planName: null,
      maxMembers: null,
      maxContentTypes: null,
      maxEntries: null,
    };
  }

  return {
    planId: ws.plan.id,
    planName: ws.plan.name,
    maxMembers: ws.plan.maxMembers,
    maxContentTypes: ws.plan.maxContentTypes,
    maxEntries: ws.plan.maxEntries,
  };
}

/**
 * Utility utama:
 *  enforcePlanLimit(workspaceId, action, options?)
 *
 * Dipanggil sebelum operasi yang menambah resource:
 *  - ADD_MEMBER       → sebelum create WorkspaceMember
 *  - ADD_CONTENT_TYPE → sebelum create ContentType
 *  - ADD_ENTRY        → sebelum create ContentEntry
 */
export async function enforcePlanLimit(workspaceId, action, options = {}) {
  const limits = await getWorkspacePlanLimits(workspaceId);

  // Jika plan tidak punya limit (null) → unlimited → lepas
  switch (action) {
    case PLAN_LIMIT_ACTIONS.ADD_MEMBER: {
      const { maxMembers } = limits;
      if (maxMembers == null) return;

      const current = await prisma.workspaceMember.count({
        where: { workspaceId },
      });

      if (current >= maxMembers) {
        const err = new Error("Member limit reached for current plan");
        err.status = 403;
        err.code = "PLAN_LIMIT_MEMBERS";
        err.meta = {
          workspaceId,
          current,
          max: maxMembers,
          planId: limits.planId,
          planName: limits.planName,
        };
        throw err;
      }
      return;
    }

    case PLAN_LIMIT_ACTIONS.ADD_CONTENT_TYPE: {
      const { maxContentTypes } = limits;
      if (maxContentTypes == null) return;

      const current = await prisma.contentType.count({
        where: { workspaceId },
      });

      if (current >= maxContentTypes) {
        const err = new Error("Content type limit reached for current plan");
        err.status = 403;
        err.code = "PLAN_LIMIT_CONTENT_TYPES";
        err.meta = {
          workspaceId,
          current,
          max: maxContentTypes,
          planId: limits.planId,
          planName: limits.planName,
        };
        throw err;
      }
      return;
    }

    case PLAN_LIMIT_ACTIONS.ADD_ENTRY: {
      const { maxEntries } = limits;
      if (maxEntries == null) return;

      // Total entries di workspace (semua ContentType).
      const current = await prisma.contentEntry.count({
        where: { workspaceId },
      });

      if (current >= maxEntries) {
        const err = new Error("Entry limit reached for current plan");
        err.status = 403;
        err.code = "PLAN_LIMIT_ENTRIES";
        err.meta = {
          workspaceId,
          current,
          max: maxEntries,
          planId: limits.planId,
          planName: limits.planName,
        };
        throw err;
      }
      return;
    }

    default: {
      // Kalau action tidak dikenal, anggap no-op (tidak blokir).
      return;
    }
  }
}
