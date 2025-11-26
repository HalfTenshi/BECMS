// src/modules/user/user.service.js
import userRepository from "./user.repository.js";

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
    const user = await userRepository.findById(id);
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async create(body) {
    const { name, email, pictureUrl, passwordHash, status } = body;

    if (!name || !email) {
      throw new Error("name and email are required");
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
    await this.get(id);

    const allowed = ["name", "email", "pictureUrl"]; // status via endpoint khusus
    const data = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k))
    );

    if (Object.keys(data).length === 0) {
      throw new Error("No updatable fields");
    }

    return userRepository.update(id, data);
  }

  async updateStatus(id, status) {
    if (!["ACTIVE", "SUSPENDED", "DEACTIVATED"].includes(status)) {
      throw new Error("Invalid status");
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
      throw new Error("Workspace membership not found");
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
