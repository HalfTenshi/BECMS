// src/modules/workspace/member.service.js
import memberRepository from "./member.repository.js";
import prisma from "../../config/prismaClient.js";
import {
  enforcePlanLimit,
  PLAN_LIMIT_ACTIONS,
} from "../../services/planLimit.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

class MemberService {
  list(workspaceId) {
    // kalau mau strict, bisa validasi workspaceId juga
    return memberRepository.list(workspaceId);
  }

  async add(workspaceId, { userId, roleId }) {
    if (!workspaceId) {
      throw ApiError.badRequest("workspaceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "WORKSPACE_ID_REQUIRED",
        resource: "WORKSPACES",
      });
    }

    if (!userId) {
      throw ApiError.badRequest("userId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "WORKSPACE_MEMBER_USER_ID_REQUIRED",
        resource: "WORKSPACES",
      });
    }

    // pastikan workspace & user ada
    const [ws, user] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!ws) {
      throw ApiError.notFound("Workspace not found", {
        code: ERROR_CODES.WORKSPACE_NOT_FOUND,
        reason: "WORKSPACE_NOT_FOUND",
        resource: "WORKSPACES",
        details: { workspaceId },
      });
    }

    if (!user) {
      throw ApiError.notFound("User not found", {
        code: ERROR_CODES.USER_NOT_FOUND,
        reason: "USER_NOT_FOUND",
        resource: "USERS",
        details: { userId },
      });
    }

    // unique guard
    const exists = await memberRepository.getByWorkspaceUser(
      workspaceId,
      userId
    );
    if (exists) {
      throw ApiError.conflict(
        "User is already a member of this workspace",
        {
          code: ERROR_CODES.VALIDATION_ERROR,
          reason: "WORKSPACE_MEMBER_ALREADY_EXISTS",
          resource: "WORKSPACES",
          details: { workspaceId, userId },
        }
      );
    }

    if (roleId) {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role || role.workspaceId !== workspaceId) {
        throw ApiError.notFound("Role not found in this workspace", {
          code: ERROR_CODES.ROLE_NOT_FOUND,
          reason: "ROLE_NOT_FOUND_IN_WORKSPACE",
          resource: "ROLES",
          details: { workspaceId, roleId },
        });
      }
    }

    // 🔐 Enforce plan limit: maxMembers
    await enforcePlanLimit(workspaceId, PLAN_LIMIT_ACTIONS.ADD_MEMBER);

    return memberRepository.add({ workspaceId, userId, roleId });
  }

  async setRole(memberId, roleId, workspaceId) {
    if (!memberId || !workspaceId) {
      throw ApiError.badRequest("memberId and workspaceId are required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "WORKSPACE_MEMBER_ID_REQUIRED",
        resource: "WORKSPACES",
        details: { memberId, workspaceId },
      });
    }

    const member = await memberRepository.findById(memberId);
    if (!member || member.workspaceId !== workspaceId) {
      throw ApiError.notFound("Member not found in this workspace", {
        code: ERROR_CODES.MEMBER_NOT_FOUND,
        reason: "WORKSPACE_MEMBER_NOT_FOUND",
        resource: "WORKSPACES",
        details: { memberId, workspaceId },
      });
    }

    if (roleId) {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role || role.workspaceId !== workspaceId) {
        throw ApiError.notFound("Role not found in this workspace", {
          code: ERROR_CODES.ROLE_NOT_FOUND,
          reason: "ROLE_NOT_FOUND_IN_WORKSPACE",
          resource: "ROLES",
          details: { workspaceId, roleId },
        });
      }
    }

    return memberRepository.setRole(memberId, roleId);
  }

  async remove(memberId, workspaceId) {
    if (!memberId || !workspaceId) {
      throw ApiError.badRequest("memberId and workspaceId are required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "WORKSPACE_MEMBER_ID_REQUIRED",
        resource: "WORKSPACES",
        details: { memberId, workspaceId },
      });
    }

    const member = await memberRepository.findById(memberId);
    if (!member || member.workspaceId !== workspaceId) {
      throw ApiError.notFound("Member not found in this workspace", {
        code: ERROR_CODES.MEMBER_NOT_FOUND,
        reason: "WORKSPACE_MEMBER_NOT_FOUND",
        resource: "WORKSPACES",
        details: { memberId, workspaceId },
      });
    }

    await memberRepository.remove(memberId);
    return { message: "Member removed" };
  }
}

export default new MemberService();
