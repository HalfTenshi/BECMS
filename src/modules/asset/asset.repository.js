import prisma from "../../config/prismaClient.js";

class AssetRepository {
  createMany(dataList) {
    return prisma.asset.createMany({ data: dataList, skipDuplicates: true });
  }

  async createOne(data) {
    return prisma.asset.create({ data });
  }

  async list({ workspaceId, q, mime, tag, folder, page = 1, limit = 20, sort = "createdAt:desc" }) {
    const [sortField, sortDir] = sort.split(":");
    const where = {
      workspaceId,
      ...(q ? { OR: [{ originalName: { contains: q, mode: "insensitive" } }, { filename: { contains: q, mode: "insensitive" } }] } : {}),
      ...(mime ? { mime: { startsWith: mime } } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(folder ? { folder } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { [sortField || "createdAt"]: (sortDir || "desc").toLowerCase() === "asc" ? "asc" : "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.asset.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  getById(id) {
    return prisma.asset.findUnique({ where: { id } });
  }

  async delete(id) {
    return prisma.asset.delete({ where: { id } });
  }

  async update(id, data) {
    return prisma.asset.update({ where: { id }, data });
  }
}

export default new AssetRepository();
