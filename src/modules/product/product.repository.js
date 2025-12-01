// =========================================================
// src/modules/product/product.repository.js
// =========================================================

import prisma from "../../config/prismaClient.js";

class ProductRepository {
  // Multi-tenant: selalu filter by workspaceId
  async findAllByWorkspace(workspaceId) {
    return prisma.product.findMany({
      where: { workspaceId },
      include: { brand: true, workspace: true },
      orderBy: { name: "asc" },
    });
  }

  async findByIdInWorkspace(id, workspaceId) {
    return prisma.product.findFirst({
      where: { id, workspaceId },
      include: { brand: true, workspace: true },
    });
  }

  async create(data) {
    // data harus sudah mengandung workspaceId di layer service
    return prisma.product.create({ data });
  }

  async update(id, workspaceId, data) {
    return prisma.product.update({
      where: { id, workspaceId },
      data,
    });
  }

  async delete(id, workspaceId) {
    return prisma.product.delete({
      where: { id, workspaceId },
    });
  }
}

export default new ProductRepository();
