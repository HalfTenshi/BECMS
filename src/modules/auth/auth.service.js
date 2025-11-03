import authRepository from "./auth.repository.js";
import { hashPassword, comparePassword } from "../../utils/password.js";
import { signAccessToken, signResetToken, verifyToken } from "../../utils/jwt.js";
import { OAuth2Client } from "google-auth-library";
import prisma from "../../config/prismaClient.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class AuthService {
  // ===================== REGISTER =====================
  async register({ name, email, password }) {
    if (!name || !email || !password) throw new Error("name, email, password are required");

    const existing = await authRepository.findUserByEmail(email);
    if (existing) throw new Error("Email already registered");

    const passwordHash = await hashPassword(password);
    const user = await authRepository.createUser({
      name,
      email,
      passwordHash,
      status: "ACTIVE", // valid (ada di schema)
    });

    const token = signAccessToken({ userId: user.id });
    return { user: { id: user.id, name: user.name, email: user.email }, token };
  }

  // ===================== LOGIN =====================
  async login({ email, password }) {
    if (!email || !password) throw new Error("email and password are required");

    const user = await authRepository.findUserByEmail(email);
    if (!user) throw new Error("Invalid credentials");

    const ok = await comparePassword(password, user.passwordHash || "");
    if (!ok) throw new Error("Invalid credentials");
    if (user.status !== "ACTIVE") throw new Error("Account not active");

    const token = signAccessToken({ userId: user.id });
    return {
      user: { id: user.id, name: user.name, email: user.email, status: user.status },
      token,
    };
  }

  // ===================== ME =====================
  async me(userId) {
    // placeholder sementara — real data diambil dari middleware auth
    return { userId };
  }

  // ===================== RESET PASSWORD =====================
  async requestReset({ email }) {
    if (!email) throw new Error("email is required");
    const user = await authRepository.findUserByEmail(email);
    if (!user) return { message: "If the email exists, reset link has been sent" };

    const resetToken = signResetToken({ userId: user.id });
    return { message: "Reset link generated", resetToken };
  }

  async resetPassword({ token, newPassword }) {
    if (!token || !newPassword) throw new Error("token and newPassword are required");
    const decoded = verifyToken(token);
    if (decoded.kind !== "reset") throw new Error("Invalid reset token");

    const passwordHash = await hashPassword(newPassword);
    await authRepository.updatePassword(decoded.userId, passwordHash);
    return { message: "Password updated" };
  }

  // ===========================================================
  // === GOOGLE ONE-TAP / SIGN-IN WITH GOOGLE (OPTION B)
  // ===========================================================
  async loginWithGoogleIdToken(idToken) {
    // 1) Verifikasi token dari Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload(); // { sub, email, name, picture, email_verified, ... }

    const email = (payload.email || "").toLowerCase();
    if (!email) throw new Error("Google account has no email");
    if (payload.email_verified === false) throw new Error("Google email is not verified");

    // 2) Cari dulu by providerId (kalau user ini sudah pernah login Google)
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
            status: "ACTIVE", // valid di schema
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

    if (user.status !== "ACTIVE") throw new Error("Account not active");

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
        // provider disimpan di tabel Account, bukan kolom User
      },
      token,
    };
  }
}

export default new AuthService();
