// src/modules/auth/auth.controller.js
import authService from "./auth.service.js";
import { ok, created } from "../../utils/response.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

class AuthController {
  // ============================
  // REGISTER
  // ============================
  async register(req, res, next) {
    try {
      const data = await authService.register(req.body);
      return created(res, data);
    } catch (e) {
      return next(
        new ApiError(400, e.message || "Failed to register user", {
          code: ERROR_CODES.REGISTER_FAILED,
        })
      );
    }
  }

  // ============================
  // LOGIN EMAIL-PASSWORD
  // ============================
  async login(req, res, next) {
    try {
      const data = await authService.login(req.body);
      return ok(res, data);
    } catch (e) {
      return next(
        new ApiError(401, e.message || "Invalid login credentials", {
          code: ERROR_CODES.LOGIN_FAILED,
        })
      );
    }
  }

  // ============================
  // AUTHENTICATED PROFILE /auth/me
  // ============================
  async me(req, res, next) {
    try {
      if (!req.user?.profile) {
        return next(
          new ApiError(401, "Authentication required", {
            code: ERROR_CODES.AUTH_REQUIRED,
          })
        );
      }

      return ok(res, { user: req.user.profile });
    } catch (e) {
      return next(
        new ApiError(400, e.message || "Failed to load profile", {
          code: ERROR_CODES.ME_FAILED,
        })
      );
    }
  }

  // ============================
  // REQUEST PASSWORD RESET
  // ============================
  async requestReset(req, res, next) {
    try {
      const data = await authService.requestReset(req.body);

      // selalu return ok=true (anti user-enumeration)
      return ok(res, data);
    } catch (e) {
      return next(
        new ApiError(
          400,
          e.message || "Failed to request password reset",
          {
            code: ERROR_CODES.REQUEST_RESET_FAILED,
          }
        )
      );
    }
  }

  // ============================
  // RESET PASSWORD
  // ============================
  async resetPassword(req, res, next) {
    try {
      const data = await authService.resetPassword(req.body);
      return ok(res, data);
    } catch (e) {
      return next(
        new ApiError(400, e.message || "Failed to reset password", {
          code: ERROR_CODES.RESET_PASSWORD_FAILED,
        })
      );
    }
  }

  // ============================
  // GOOGLE ONE-TAP LOGIN
  // ============================
  async googleOneTap(req, res, next) {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        return next(
          new ApiError(400, "idToken is required", {
            code: ERROR_CODES.GOOGLE_IDTOKEN_REQUIRED,
          })
        );
      }

      const data = await authService.loginWithGoogleIdToken(idToken);
      return ok(res, data);
    } catch (e) {
      return next(
        new ApiError(401, e.message || "Google login failed", {
          code: ERROR_CODES.GOOGLE_LOGIN_FAILED,
        })
      );
    }
  }
}

export default new AuthController();
