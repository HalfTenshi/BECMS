// =========================================================
// src/services/planLimit.service.js
// =========================================================

import prisma from "../config/prismaClient.js";
import { ApiError } from "../utils/ApiError.js";
import { ERROR_CODES } from "../constants/errorCodes.js";

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
    throw ApiError.badRequest("workspaceId is required", {
      code: ERROR_CODES.WORKSPACE_REQUIRED,
      reason: "PLAN_LIMIT_WORKSPACE_ID_MISSING",
    });
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
    throw ApiError.notFound("Workspace not found", {
      code: ERROR_CODES.WORKSPACE_NOT_FOUND,
      reason: "PLAN_LIMIT_WORKSPACE_NOT_FOUND",
    });
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

  switch (action) {
    case PLAN_LIMIT_ACTIONS.ADD_MEMBER: {
      const { maxMembers, planId, planName } = limits;
      if (maxMembers == null) return;

      const current = await prisma.workspaceMember.count({
        where: { workspaceId },
      });

      if (current >= maxMembers) {
        throw ApiError.forbidden("Member limit reached for current plan", {
          code: ERROR_CODES.PLAN_LIMIT_MEMBERS,
          reason: ERROR_CODES.PLAN_LIMIT_EXCEEDED,
          action,
          resource: "MEMBERS",
          details: {
            workspaceId,
            current,
            max: maxMembers,
            planId,
            planName,
          },
        });
      }
      return;
    }

    case PLAN_LIMIT_ACTIONS.ADD_CONTENT_TYPE: {
      const { maxContentTypes, planId, planName } = limits;
      if (maxContentTypes == null) return;

      const current = await prisma.contentType.count({
        where: { workspaceId },
      });

      if (current >= maxContentTypes) {
        throw ApiError.forbidden(
          "Content type limit reached for current plan",
          {
            code: ERROR_CODES.PLAN_LIMIT_CONTENT_TYPES,
            reason: ERROR_CODES.PLAN_LIMIT_EXCEEDED,
            action,
            resource: "CONTENT_TYPES",
            details: {
              workspaceId,
              current,
              max: maxContentTypes,
              planId,
              planName,
            },
          }
        );
      }
      return;
    }

    case PLAN_LIMIT_ACTIONS.ADD_ENTRY: {
      const { maxEntries, planId, planName } = limits;
      if (maxEntries == null) return;

      // Total entries di workspace (semua ContentType).
      const current = await prisma.contentEntry.count({
        where: { workspaceId },
      });

      if (current >= maxEntries) {
        throw ApiError.forbidden("Entry limit reached for current plan", {
          code: ERROR_CODES.PLAN_LIMIT_ENTRIES,
          reason: ERROR_CODES.PLAN_LIMIT_EXCEEDED,
          action,
          resource: "CONTENT_ENTRIES",
          details: {
            workspaceId,
            current,
            max: maxEntries,
            planId,
            planName,
          },
        });
      }
      return;
    }

    default: {
      // Kalau action tidak dikenal, anggap no-op (tidak blokir).
      return;
    }
  }
}
