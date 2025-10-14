import prisma from "../../config/prismaClient.js";

class ContentEntryRepository {
  async findAll() {
    return prisma.contentEntry.findMany({
      include: { contentType: true, values: true },
    });
  }

  async findById(id) {
    return prisma.contentEntry.findUnique({
      where: { id },
      include: { contentType: true, values: true },
    });
  }

  async create(data) {
    return prisma.contentEntry.create({ data });
  }

  async update(id, data) {
    return prisma.contentEntry.update({ where: { id }, data });
  }

  async delete(id) {
    return prisma.contentEntry.delete({ where: { id } });
  }

  async publish(id) {
    return prisma.contentEntry.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
    });
  }
}

export default new ContentEntryRepository();
