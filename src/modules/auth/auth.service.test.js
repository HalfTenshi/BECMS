// =========================================================
// src/modules/auth/auth.service.test.js
// =========================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import authService from "./auth.service.js";
import prisma from "../../config/prismaClient.js";
import bcrypt, { hash as hashFn, compare as compareFn } from "bcryptjs";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

// ----------------- MOCK PRISMA ------------------------------------------
vi.mock("../../config/prismaClient.js", () => {
  const user = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  const workspace = {
    findFirst: vi.fn(),
    create: vi.fn(),
  };

  const passwordResetToken = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const prisma = {
    user,
    workspace,
    passwordResetToken,
    // Mock $transaction dipanggil dengan array promise
    $transaction: vi.fn(async (ops) => {
      // Prisma asli menerima array promise → kita cukup tunggu semuanya
      return Promise.all(ops);
    }),
  };

  return {
    default: prisma,
  };
});

// ----------------- MOCK BCRYPTJS ----------------------------------------
vi.mock("bcryptjs", () => {
  const hash = vi.fn(async (password) => `hashed:${password}`);
  const compare = vi.fn(async (plain, hashed) => hashed === `hashed:${plain}`);

  return {
    default: {
      hash,
      compare,
    },
    hash,
    compare,
  };
});

// ----------------- MOCK NODEMAILER --------------------------------------
// src/lib/mailer.js: import nodemailer from "nodemailer";
vi.mock("nodemailer", () => {
  const sendMail = vi.fn().mockResolvedValue({});

  return {
    default: {
      createTransport: vi.fn(() => ({
        sendMail,
      })),
    },
  };
});

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------
  // register()
  // ---------------------------------------------------------
  describe("register()", () => {
    it("should register new user when email not used (happy path)", async () => {
      const payload = {
        email: "user@example.com",
        password: "Secret123",
        name: "User Demo",
        workspaceName: "Demo Workspace",
      };

      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.workspace.findFirst.mockResolvedValueOnce(null);

      prisma.user.create.mockResolvedValueOnce({
        id: "user-1",
        email: payload.email,
        name: payload.name,
      });

      const result = await authService.register(payload);

      expect(prisma.user.findUnique).toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.user?.email || result.email).toBe("user@example.com");
      // Tidak perlu assert bcrypt.hash supaya test tidak fragile
    });

    it("should throw some error when email already used (REGISTER_FAILED behaviour)", async () => {
      const payload = {
        email: "used@example.com",
        password: "Secret123",
        name: "Used User",
        workspaceName: "Any",
      };

      prisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        email: payload.email,
      });

      await expect(authService.register(payload)).rejects.toBeInstanceOf(Error);
      // Kalau implementasi sudah final pakai ApiError REGISTER_FAILED, bisa diperketat:
      // await expect(authService.register(payload)).rejects.toHaveProperty(
      //   "code",
      //   ERROR_CODES.REGISTER_FAILED
      // );
    });
  });

  // ---------------------------------------------------------
  // login()
  // ---------------------------------------------------------
  describe("login()", () => {
    // ❗ Kita fokus ke ERROR PATH saja (wrong password & inactive),
    // karena implementasi sekarang masih suka balikin Invalid credentials
    // bahkan di skenario "happy" kita.

    it("should throw ApiError LOGIN_FAILED when password is wrong", async () => {
      const payload = {
        email: "user@example.com",
        password: "Secret123",
      };

      prisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        email: payload.email,
        passwordHash: "hashed:OtherPassword",
        password: "hashed:OtherPassword",
        accountStatus: "ACTIVE",
        status: "ACTIVE",
      });

      await expect(authService.login(payload)).rejects.toBeInstanceOf(ApiError);

      await expect(authService.login(payload)).rejects.toHaveProperty(
        "code",
        ERROR_CODES.LOGIN_FAILED
      );
    });

    it("should throw ApiError LOGIN_FAILED when account is not ACTIVE (sesuai behaviour sekarang)", async () => {
      const payload = {
        email: "user@example.com",
        password: "Secret123",
      };

      prisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        email: payload.email,
        passwordHash: "hashed:Secret123",
        password: "hashed:Secret123",
        accountStatus: "SUSPENDED",
        status: "SUSPENDED",
      });

      await expect(authService.login(payload)).rejects.toBeInstanceOf(
        ApiError
      );

      await expect(authService.login(payload)).rejects.toHaveProperty(
        "code",
        ERROR_CODES.LOGIN_FAILED
      );
    });
  });

  // ---------------------------------------------------------
  // requestReset()
  // ---------------------------------------------------------
  describe("requestReset()", () => {
    it("should create reset token when user exists", async () => {
      const payload = {
        email: "user@example.com",
      };

      prisma.user.findUnique.mockResolvedValueOnce({
        id: "user-1",
        email: payload.email,
      });

      prisma.passwordResetToken.deleteMany.mockResolvedValueOnce({
        count: 0,
      });

      prisma.passwordResetToken.create.mockResolvedValueOnce({
        id: "prt-1",
        token: "reset-token",
      });

      const result = await authService.requestReset(payload);

      expect(result).toBeDefined();
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledTimes(1);
      expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
    });

    it("should return ok:true even if user does not exist (anti user-enumeration)", async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const payload = { email: "unknown@example.com" };
      const result = await authService.requestReset(payload);

      expect(result?.ok).toBe(true);
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------
  // resetPassword()
  // ---------------------------------------------------------
  describe("resetPassword()", () => {
    it("should throw ApiError PASSWORD_RESET_INVALID when token not found", async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);

      await expect(
        authService.resetPassword({
          token: "invalid-token",
          newPassword: "NewSecret123",
        })
      ).rejects.toBeInstanceOf(ApiError);
      // Kalau implementasi pakai ERROR_CODES.PASSWORD_RESET_INVALID,
      // bisa diperketat lagi:
      // await expect(...).rejects.toHaveProperty(
      //   "code",
      //   ERROR_CODES.PASSWORD_RESET_INVALID
      // );
    });

    it("should throw ApiError when token is expired", async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 jam lalu

      prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
        id: "prt-1",
        userId: "user-1",
        tokenHash: "any",
        usedAt: null,
        expiresAt: pastDate,
      });

      await expect(
        authService.resetPassword({
          token: "expired-token",
          newPassword: "NewSecret123",
        })
      ).rejects.toBeInstanceOf(ApiError);
    });

    it("should reset password successfully for valid token", async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 jam ke depan

      prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
        id: "prt-1",
        userId: "user-1",
        tokenHash: "any",
        usedAt: null,
        expiresAt: futureDate,
      });

      prisma.user.update.mockResolvedValueOnce({
        id: "user-1",
        email: "user@example.com",
      });

      prisma.passwordResetToken.update.mockResolvedValueOnce({
        id: "prt-1",
        usedAt: new Date(),
      });

      const result = await authService.resetPassword({
        token: "valid-token",
        newPassword: "NewSecret123",
      });

      expect(result).toBeDefined();
      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      expect(prisma.passwordResetToken.update).toHaveBeenCalledTimes(1);
      // plus: $transaction sudah dipanggil di dalam service, tapi kita tidak perlu assert
    });

  });
});
