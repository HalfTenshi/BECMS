// =========================================================
// src/modules/brand/brand.repository.js
// =========================================================

import prisma from "../../config/prismaClient.js";

class BrandRepository {
  // Multi-tenant: selalu filter by workspaceId
  async findAllByWorkspace(workspaceId) {
    return prisma.brand.findMany({
      where: { workspaceId },
      include: { products: true, workspace: true },
      orderBy: { name: "asc" },
    });
  }

  async findByIdInWorkspace(id, workspaceId) {
    return prisma.brand.findFirst({
      where: { id, workspaceId },
      include: { products: true, workspace: true },
    });
  }

  async create(data) {
    // data harus sudah mengandung workspaceId di layer service
    return prisma.brand.create({ data });
  }

  async update(id, workspaceId, data) {
    // jaga-jaga: enforce workspaceId di level DB juga
    return prisma.brand.update({
      where: { id, workspaceId },
      data,
    });
  }

  async delete(id, workspaceId) {
    return prisma.brand.delete({
      where: { id, workspaceId },
    });
  }
}

export default new BrandRepository();
