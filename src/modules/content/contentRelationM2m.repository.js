import prisma from "../../config/prismaClient.js";

class ContentRelationM2mRepository {
  async attach({ workspaceId, relationFieldId, fromEntryId, toEntryId }) {
    return prisma.contentRelationM2M.upsert({
      where: { uniq_m2m_rel_triple: { relationFieldId, fromEntryId, toEntryId } },
      update: {},
      create: { workspaceId, relationFieldId, fromEntryId, toEntryId },
    });
  }

  async attachMany({ workspaceId, relationFieldId, fromEntryId, toEntryIds = [] }) {
    if (!toEntryIds.length) return [];
    return prisma.$transaction(
      toEntryIds.map((toEntryId) =>
        prisma.contentRelationM2M.upsert({
          where: { uniq_m2m_rel_triple: { relationFieldId, fromEntryId, toEntryId } },
          update: {},
          create: { workspaceId, relationFieldId, fromEntryId, toEntryId },
        })
      )
    );
  }

  async detach({ relationFieldId, fromEntryId, toEntryId }) {
    return prisma.contentRelationM2M.delete({
      where: { uniq_m2m_rel_triple: { relationFieldId, fromEntryId, toEntryId } },
    });
  }

  async detachMany({ relationFieldId, fromEntryId, toEntryIds = [] }) {
    if (!toEntryIds.length) return { count: 0 };
    return prisma.contentRelationM2M.deleteMany({
      where: { relationFieldId, fromEntryId, toEntryId: { in: toEntryIds } },
    });
  }

  async clear({ relationFieldId, fromEntryId }) {
    return prisma.contentRelationM2M.deleteMany({ where: { relationFieldId, fromEntryId } });
  }

  async listRelated({ relationFieldId, fromEntryId, page = 1, pageSize = 20 }) {
    const skip = (page - 1) * pageSize;
    const [rows, total] = await prisma.$transaction([
      prisma.contentRelationM2M.findMany({
        where: { relationFieldId, fromEntryId },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: { toEntryId: true },
      }),
      prisma.contentRelationM2M.count({ where: { relationFieldId, fromEntryId } }),
    ]);
    return { rows, total, page, pageSize };
  }

  async findFromByRelated({ relationFieldId, relatedEntryId, page = 1, pageSize = 20 }) {
    const skip = (page - 1) * pageSize;
    const [rows, total] = await prisma.$transaction([
      prisma.contentRelationM2M.findMany({
        where: { relationFieldId, toEntryId: relatedEntryId },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: { fromEntryId: true },
      }),
      prisma.contentRelationM2M.count({ where: { relationFieldId, toEntryId: relatedEntryId } }),
    ]);
    return { rows, total, page, pageSize };
  }
}

export default new ContentRelationM2mRepository();
