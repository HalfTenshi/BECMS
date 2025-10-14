import prisma from "../../../config/prismaClient.js";

class FieldValueRepository {
  async findByEntry(entryId) {
    return prisma.fieldValue.findMany({
      where: { entryId },
      include: { field: true },
    });
  }

  async create(data) {
    return prisma.fieldValue.create({ data });
  }

  async update(id, data) {
    return prisma.fieldValue.update({ where: { id }, data });
  }

  async delete(id) {
    return prisma.fieldValue.delete({ where: { id } });
  }
}

export default new FieldValueRepository();
