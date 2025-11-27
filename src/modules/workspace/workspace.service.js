// src/modules/workspace/workspace.service.js

import workspaceRepository from "./workspace.repository.js";
import { ensureWorkspaceDefaultRoleBinding } from "../rbac/rbac.seed.js";
import { ApiError } from "../../utils/ApiError.js";

class WorkspaceService {
  async getAll() {
    return workspaceRepository.findAll();
  }

  async getById(id) {
    const workspace = await workspaceRepository.findById(id);
    if (!workspace) {
      throw new ApiError(404, "Workspace not found", {
        code: "WORKSPACE_NOT_FOUND",
        reason: "WORKSPACE_NOT_FOUND",
      });
    }
    return workspace;
  }

  async create(data) {
    if (!data?.name || !data?.ownerId) {
      throw new ApiError(400, "Name and ownerId are required", {
        code: "WORKSPACE_CREATE_VALIDATION_ERROR",
        reason: "VALIDATION_ERROR",
      });
    }

    // 1) Buat workspace baru
    const workspace = await workspaceRepository.create({
      name: data.name,
      ownerId: data.ownerId,
      ...data, // jaga-jaga kalau ada field tambahan
    });

    // 2) Pastikan owner otomatis punya role OWNER di workspace ini
    await ensureWorkspaceDefaultRoleBinding(workspace.id, data.ownerId);

    return workspace;
  }

  async update(id, data) {
    await this.getById(id);
    return workspaceRepository.update(id, data);
  }

  async delete(id) {
    await this.getById(id);
    return workspaceRepository.delete(id);
  }
}

export default new WorkspaceService();
