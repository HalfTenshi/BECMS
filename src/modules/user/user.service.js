// src/modules/user/user.service.js
import userRepository from "./user.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

class UserService {
  list(query) {
    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const limit = Math.max(
      1,
      Math.min(100, parseInt(query.limit ?? "10", 10))
    );
    const search = query.search?.trim() || undefined;
    const status = query.status || undefined; // "ACTIVE" | "SUSPENDED" | "DEACTIVATED"

    return userRepository.findAll({ search, status, page, limit });
  }

  async get(id) {
    if (!id) {
      throw ApiError.badRequest("User id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "USER_ID_REQUIRED",
        resource: "USERS",
      });
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw ApiError.notFound("User not found", {
        code: ERROR_CODES.USER_NOT_FOUND,
        reason: "USER_NOT_FOUND",
        resource: "USERS",
        details: { id },
      });
    }
    return user;
  }

  async create(body) {
    const { name, email, pictureUrl, passwordHash, status } = body || {};

    if (!name || !email) {
      throw ApiError.badRequest("name and email are required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "USER_VALIDATION_FAILED",
        resource: "USERS",
        details: {
          hasName: !!name,
          hasEmail: !!email,
        },
      });
    }

    // passwordHash opsional: biasanya dibuat di auth flow,
    // tapi untuk seed/admin bisa diisi manual (hash sudah siap)
    return userRepository.create({
      name,
      email,
      pictureUrl,
      passwordHash,
      status,
    });
  }

  async update(id, body) {
    await this.get(id); // lempar ApiError kalau tidak ditemukan

    const allowed = ["name", "email", "pictureUrl"]; // status via endpoint khusus
    const data = Object.fromEntries(
      Object.entries(body || {}).filter(([k]) => allowed.includes(k))
    );

    if (Object.keys(data).length === 0) {
      throw ApiError.badRequest("No updatable fields", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "USER_NO_UPDATABLE_FIELDS",
        resource: "USERS",
      });
    }

    return userRepository.update(id, data);
  }

  async updateStatus(id, status) {
    const allowed = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];

    if (!allowed.includes(status)) {
      throw ApiError.badRequest("Invalid status", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "USER_INVALID_STATUS",
        resource: "USERS",
        details: { status, allowed },
      });
    }

    await this.get(id);
    return userRepository.updateStatus(id, status);
  }

  async remove(id) {
    await this.get(id);
    await userRepository.delete(id);
    return { message: "User deleted" };
  }

  // Profil user + role + permissions di workspace aktif
  async me(userId, workspaceId) {
    const member =
      await userRepository.getProfileWithRoleAndPermissions(
        userId,
        workspaceId
      );

    if (!member) {
      throw ApiError.notFound("Workspace membership not found", {
        code: ERROR_CODES.MEMBER_NOT_FOUND,
        reason: "WORKSPACE_MEMBER_NOT_FOUND",
        resource: "USERS",
        details: { userId, workspaceId },
      });
    }

    const { user, workspace, role } = member;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      pictureUrl: user.pictureUrl,
      status: user.status,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: role
          ? {
              id: role.id,
              name: role.name,
            }
          : null,
        permissions: role
          ? role.rolePerms.map((rp) => ({
              module: rp.permission.module,
              action: rp.permission.action,
            }))
          : [],
      },
    };
  }
}

export default new UserService();
