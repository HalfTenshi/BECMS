import prisma from "../../config/prismaClient.js";

class ContentTypeRepository {
  async findAll() {
    return prisma.contentType.findMany({
      include: { fields: true },
    });
  }

  async findById(id) {
    return prisma.contentType.findUnique({
      where: { id },
      include: { fields: true },
    });
  }

  async create(data) {
    return prisma.contentType.create({
      data: {
        name: data.name,
        apiKey: data.apiKey,
        workspaceId: data.workspaceId,
        description: data.description,
      },
    });
  }

  async update(id, data) {
    return prisma.contentType.update({ where: { id }, data });
  }

  async delete(id) {
    return prisma.contentType.delete({ where: { id } });
  }
}

export default new ContentTypeRepository();
