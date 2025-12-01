// src/modules/auth/auth.service.js

import authRepository from "./auth.repository.js";
import { hashPassword, comparePassword } from "../../utils/password.js";
import { signAccessToken } from "../../utils/jwt.js"; // ⬅️ reset token TIDAK pakai JWT lagi
import { OAuth2Client } from "google-auth-library";
import prisma from "../../config/prismaClient.js";
import { sendMail } from "../../lib/mailer.js"; // ⬅️ util kirim email (nodemailer)
import { generateToken, sha256 } from "../../utils/token.js"; // ⬅️ helper token & hash
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const TTL_MIN = Number(process.env.RESET_TOKEN_TTL_MINUTES || 30);
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";

class AuthService {
  // ===================== REGISTER =====================
  async register({ name, email, password }) {
    if (!name || !email || !password) {
      throw ApiError.badRequest("name, email, password are required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "REGISTER_MISSING_FIELDS",
      });
    }

    const existing = await authRepository.findUserByEmail(email.toLowerCase());
    if (existing) {
      throw ApiError.conflict("Email already registered", {
        code: ERROR_CODES.REGISTER_FAILED,
        reason: "EMAIL_ALREADY_REGISTERED",
        details: { email: email.toLowerCase() },
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await authRepository.createUser({
      name,
      email: email.toLowerCase(),
      passwordHash,
      status: "ACTIVE",
    });

    const token = signAccessToken({ userId: user.id });
    return {
      user: { id: user.id, name: user.name, email: user.email },
      token,
    };
  }

  // ===================== LOGIN =====================
  async login({ email, password }) {
    if (!email || !password) {
      throw ApiError.badRequest("email and password are required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "LOGIN_MISSING_FIELDS",
      });
    }

    const user = await authRepository.findUserByEmail(email.toLowerCase());
    if (!user) {
      throw ApiError.unauthorized("Invalid credentials", {
        code: ERROR_CODES.LOGIN_FAILED,
        reason: "LOGIN_INVALID_CREDENTIALS",
      });
    }

    const ok = await comparePassword(password, user.passwordHash || "");
    if (!ok) {
      throw ApiError.unauthorized("Invalid credentials", {
        code: ERROR_CODES.LOGIN_FAILED,
        reason: "LOGIN_INVALID_CREDENTIALS",
      });
    }

    if (user.status !== "ACTIVE") {
      throw ApiError.forbidden("Account not active", {
        code: ERROR_CODES.ACCOUNT_INACTIVE,
        reason: "ACCOUNT_NOT_ACTIVE",
      });
    }

    const token = signAccessToken({ userId: user.id });
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
      token,
    };
  }

  // ===================== ME =====================
  async me(userId) {
    // placeholder — data detail biasanya diisi middleware auth
    return { userId };
  }

  // ===================== RESET PASSWORD (EMAIL) =====================
  /**
   * Kirim email reset password berisi link dengan token PLAIN (disimpan HASH-nya di DB).
   * ALWAYS return ok (anti user enumeration).
   */
  async requestReset({ email }) {
    if (!email) {
      throw ApiError.badRequest("email is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "RESET_EMAIL_REQUIRED",
      });
    }

    const user = await authRepository.findUserByEmail(email.toLowerCase());

    // Balasan selalu ok agar tidak bisa deteksi akun terdaftar
    if (!user || (user.status && ["SUSPENDED", "DEACTIVATED"].includes(user.status))) {
      return { ok: true };
    }

    // 1) Buat token & simpan HASH-nya di DB
    const tokenPlain = generateToken(32);
    const tokenHash = sha256(tokenPlain);
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000);

    // Revoke token aktif sebelumnya
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    });

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // 2) Kirim email berisi link FE
    const resetUrl = `${APP_BASE_URL}/reset-password?token=${tokenPlain}`;
    const subject = "Reset your BECMS password";
    const text = `We received a request to reset your password.\n\nReset link (valid ${TTL_MIN} minutes):\n${resetUrl}\n\nIf you did not request this, ignore this email.`;
    const html = `
      <p>We received a request to reset your password.</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:10px 14px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none" target="_blank">Reset Password</a></p>
      <p>This link will expire in <b>${TTL_MIN} minutes</b>. If you did not request this, just ignore this email.</p>
    `;

    await sendMail({ to: user.email, subject, html, text });
    return { ok: true };
  }

  /**
   * Reset password menggunakan token PLAIN dari email.
   * Validasi: token ada, belum dipakai, belum kadaluarsa.
   */
  async resetPassword({ token, newPassword }) {
    if (!token || !newPassword) {
      throw ApiError.badRequest("token and newPassword are required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "RESET_MISSING_FIELDS",
      });
    }

    const tokenHash = sha256(token);
    const now = new Date();

    const rec = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!rec || rec.usedAt || rec.expiresAt <= now) {
      // Pesan tetap generic untuk keamanan
      throw ApiError.badRequest("Token invalid or expired", {
        code: ERROR_CODES.TOKEN_INVALID,
        reason: "RESET_TOKEN_INVALID_OR_EXPIRED",
      });
    }

    const passwordHash = await hashPassword(newPassword);

    // Transaksi: update pw + tandai token used + revoke token lain
    await prisma.$transaction([
      prisma.user.update({ where: { id: rec.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({
        where: { id: rec.id },
        data: { usedAt: now },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: rec.userId, usedAt: null },
      }),
    ]);

    return { ok: true };
  }

  // ===========================================================
  // === GOOGLE ONE-TAP / SIGN-IN WITH GOOGLE (OPTION B)
  // ===========================================================
  async loginWithGoogleIdToken(idToken) {
    if (!idToken) {
      throw ApiError.badRequest("idToken is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "GOOGLE_ID_TOKEN_REQUIRED",
      });
    }

    // 1) Verifikasi token dari Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload(); // { sub, email, name, picture, email_verified, ... }

    const email = (payload.email || "").toLowerCase();
    if (!email) {
      throw ApiError.badRequest("Google account has no email", {
        code: ERROR_CODES.LOGIN_FAILED,
        reason: "GOOGLE_NO_EMAIL",
      });
    }
    if (payload.email_verified === false) {
      throw ApiError.badRequest("Google email is not verified", {
        code: ERROR_CODES.LOGIN_FAILED,
        reason: "GOOGLE_EMAIL_NOT_VERIFIED",
      });
    }

    // 2) Cari account Google terdahulu
    const existingAccount = await prisma.account.findUnique({
      where: { provider_providerId: { provider: "GOOGLE", providerId: payload.sub } },
      include: { user: true },
    });

    let user;
    if (existingAccount) {
      user = existingAccount.user;
      // update ringan info profil (opsional)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: payload.name || user.name,
          pictureUrl: payload.picture || user.pictureUrl,
        },
      });
    } else {
      // 3) Belum ada akun Google -> cek user by email; buat kalau belum ada
      user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name: payload.name || email,
            pictureUrl: payload.picture || null,
            status: "ACTIVE",
          },
        });
      }

      // 4) Tautkan provider Google ke user tsb
      await prisma.account.create({
        data: {
          provider: "GOOGLE",      // enum AuthProvider
          providerId: payload.sub, // subject unik dari Google
          userId: user.id,
        },
      });
    }

    if (user.status !== "ACTIVE") {
      throw ApiError.forbidden("Account not active", {
        code: ERROR_CODES.ACCOUNT_INACTIVE,
        reason: "ACCOUNT_NOT_ACTIVE",
      });
    }

    // 5) (Opsional) pastikan membership workspace default
    const ws = await prisma.workspace.upsert({
      where: { slug: "default" },
      update: {},
      create: { name: "Default", slug: "default", ownerId: user.id },
    });

    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws.id, userId: user.id } },
      update: {},
      create: { workspaceId: ws.id, userId: user.id, roleId: null },
    });

    // 6) Terbitkan JWT internal seperti login biasa
    const token = signAccessToken({ userId: user.id });
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        pictureUrl: user.pictureUrl,
      },
      token,
    };
  }
}

export default new AuthService();
