import prisma from "../../../config/prismaClient.js";

class ContentRelationRepository {
  async findAll() {
    return prisma.contentRelation.findMany({
      include: { field: true, from: true, to: true },
    });
  }

  async create(data) {
    return prisma.contentRelation.create({ data });
  }

  async delete(id) {
    return prisma.contentRelation.delete({ where: { id } });
  }
}

export default new ContentRelationRepository();
