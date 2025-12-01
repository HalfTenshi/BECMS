// src/modules/role/permission.service.js
import permissionRepository from "./permission.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

class PermissionService {
  getAll() {
    return permissionRepository.findAll();
  }

  async getById(id) {
    if (!id) {
      throw ApiError.badRequest("Permission id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PERMISSION_ID_REQUIRED",
        resource: "PERMISSIONS",
      });
    }

    const p = await permissionRepository.findById(id);
    if (!p) {
      throw ApiError.notFound("Permission not found", {
        code: ERROR_CODES.PERMISSION_NOT_FOUND,
        reason: "PERMISSION_NOT_FOUND",
        resource: "PERMISSIONS",
        details: { id },
      });
    }
    return p;
  }

  async create(data) {
    if (!data?.name || !data?.action || !data?.module) {
      throw ApiError.badRequest(
        "Fields 'name', 'action', and 'module' are required",
        {
          code: ERROR_CODES.VALIDATION_ERROR,
          reason: "PERMISSION_VALIDATION_FAILED",
          resource: "PERMISSIONS",
          details: {
            hasName: !!data?.name,
            hasAction: !!data?.action,
            hasModule: !!data?.module,
          },
        }
      );
    }

    return permissionRepository.create(data);
  }

  async update(id, data) {
    await this.getById(id); // akan lempar ApiError kalau tidak ada
    return permissionRepository.update(id, data);
  }

  async delete(id) {
    await this.getById(id); // akan lempar ApiError kalau tidak ada
    return permissionRepository.delete(id);
  }
}

export default new PermissionService();
