// src/modules/role/role.service.js
import roleRepository from "./role.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

class RoleService {
  getAll() {
    return roleRepository.findAll();
  }

  async getById(id) {
    if (!id) {
      throw ApiError.badRequest("Role id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "ROLE_ID_REQUIRED",
        resource: "ROLES",
      });
    }

    const role = await roleRepository.findById(id);
    if (!role) {
      throw ApiError.notFound("Role not found", {
        code: ERROR_CODES.ROLE_NOT_FOUND,
        reason: "ROLE_NOT_FOUND",
        resource: "ROLES",
        details: { id },
      });
    }
    return role;
  }

  async create(data) {
    if (!data?.name) {
      throw ApiError.badRequest("Field 'name' is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "ROLE_NAME_REQUIRED",
        resource: "ROLES",
      });
    }

    return roleRepository.create(data);
  }

  async update(id, data) {
    await this.getById(id); // not found → ApiError
    return roleRepository.update(id, data);
  }

  async delete(id) {
    await this.getById(id);
    return roleRepository.delete(id);
  }

  async addPermissions(roleId, permissionIds) {
    await this.getById(roleId);

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      throw ApiError.badRequest("permissionIds must be a non-empty array", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "ROLE_PERMISSION_IDS_INVALID",
        resource: "ROLES",
        details: { permissionIds },
      });
    }

    await roleRepository.addPermissions(roleId, permissionIds);
    return this.getById(roleId);
  }

  async removePermissions(roleId, permissionIds) {
    await this.getById(roleId);

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      throw ApiError.badRequest("permissionIds must be a non-empty array", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "ROLE_PERMISSION_IDS_INVALID",
        resource: "ROLES",
        details: { permissionIds },
      });
    }

    await roleRepository.removePermissions(roleId, permissionIds);
    return this.getById(roleId);
  }
}

export default new RoleService();
S