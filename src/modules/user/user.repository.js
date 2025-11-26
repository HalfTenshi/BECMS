// src/modules/user/user.repository.js
import prisma from "../../config/prismaClient.js";

class UserRepository {
  async findAll({ search, status, page = 1, limit = 10 }) {
    const where = {
      AND: [
        status ? { status } : {},
        search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          pictureUrl: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  findById(id) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        pictureUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  findByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        pictureUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  create({ name, email, pictureUrl, passwordHash, status }) {
    return prisma.user.create({
      data: { name, email, pictureUrl, passwordHash, status },
      select: {
        id: true,
        name: true,
        email: true,
        pictureUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  update(id, data) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        pictureUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  updateStatus(id, status) {
    return prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        name: true,
        email: true,
        pictureUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  delete(id) {
    return prisma.user.delete({ where: { id } });
  }

  // Profil + role + permissions di workspace tertentu
  async getProfileWithRoleAndPermissions(userId, workspaceId) {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            pictureUrl: true,
            status: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            rolePerms: {
              include: {
                permission: {
                  select: {
                    module: true,
                    action: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return member;
  }
}

export default new UserRepository();
