// src/modules/user/user.controller.js
import userService from "./user.service.js";
import { ok, created, noContent } from "../../utils/response.js";
import { ApiError } from "../../utils/ApiError.js";

class UserController {
  async getAll(req, res, next) {
    try {
      const data = await userService.list(req.query);
      return ok(res, data);
    } catch (e) {
      return next(
        new ApiError(400, e.message || "Failed to fetch users", {
          code: "USER_LIST_FAILED",
        })
      );
    }
  }

  async getById(req, res, next) {
    try {
      const data = await userService.get(req.params.id);
      return ok(res, data);
    } catch (e) {
      return next(
        new ApiError(404, e.message || "User not found", {
          code: "USER_NOT_FOUND",
        })
      );
    }
  }

  async create(req, res, next) {
    try {
      const data = await userService.create(req.body);
      return created(res, data);
    } catch (e) {
      return next(
        new ApiError(400, e.message || "Failed to create user", {
          code: "USER_CREATE_FAILED",
        })
      );
    }
  }

  async update(req, res, next) {
    try {
      const data = await userService.update(req.params.id, req.body);
      return ok(res, data);
    } catch (e) {
      return next(
        new ApiError(400, e.message || "Failed to update user", {
          code: "USER_UPDATE_FAILED",
        })
      );
    }
  }

  async updateStatus(req, res, next) {
    try {
      const data = await userService.updateStatus(
        req.params.id,
        req.body.status
      );
      return ok(res, data);
    } catch (e) {
      return next(
        new ApiError(400, e.message || "Failed to update user status", {
          code: "USER_STATUS_UPDATE_FAILED",
        })
      );
    }
  }

  async delete(req, res, next) {
    try {
      await userService.remove(req.params.id);
      return noContent(res);
    } catch (e) {
      return next(
        new ApiError(404, e.message || "User not found", {
          code: "USER_DELETE_FAILED",
        })
      );
    }
  }

  // Profil user + role + permission di workspace aktif
  async me(req, res, next) {
    try {
      const userId = req.user?.id;
      const workspaceId = req.workspaceId || req.workspace?.id;

      if (!userId) {
        return next(
          new ApiError(401, "Authentication required", {
            code: "AUTH_REQUIRED",
          })
        );
      }

      if (!workspaceId) {
        return next(
          new ApiError(400, "workspaceId is required", {
            code: "WORKSPACE_REQUIRED",
          })
        );
      }

      const profile = await userService.me(userId, workspaceId);
      return ok(res, { user: profile });
    } catch (e) {
      if (e instanceof ApiError) return next(e);

      return next(
        new ApiError(400, e.message || "Failed to load user profile", {
          code: "USER_ME_FAILED",
        })
      );
    }
  }
}

export default new UserController();
