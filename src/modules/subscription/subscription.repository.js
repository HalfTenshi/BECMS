// src/modules/subscription/subscription.repository.js
import prisma from "../../config/prismaClient.js";

class SubscriptionRepository {
  async getActiveByWorkspace(workspaceId) {
    return prisma.subscription.findFirst({
      where: {
        workspaceId,
        status: "ACTIVE",
      },
      orderBy: {
        startedAt: "desc",
      },
    });
  }

  async listByWorkspace(workspaceId) {
    return prisma.subscription.findMany({
      where: { workspaceId },
      orderBy: {
        startedAt: "desc",
      },
    });
  }

  /**
   * Buat subscription baru dalam satu workspace.
   * NOTE: transaksi di-handle di service.
   */
  async create(data, tx = prisma) {
    return tx.subscription.create({ data });
  }

  async updateStatus(id, { status, cancelledAt, expiredAt }, tx = prisma) {
    return tx.subscription.update({
      where: { id },
      data: {
        status,
        cancelledAt: cancelledAt ?? undefined,
        expiredAt: expiredAt ?? undefined,
      },
    });
  }

  async expireAllActive(workspaceId, tx = prisma) {
    return tx.subscription.updateMany({
      where: {
        workspaceId,
        status: "ACTIVE",
      },
      data: {
        status: "EXPIRED",
        expiredAt: new Date(),
      },
    });
  }
}

export default new SubscriptionRepository();
