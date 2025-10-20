import prisma from "../../config/prismaClient.js";

class BrandRepository {
  async findAll() {
    return prisma.brand.findMany({
      include: { products: true, workspace: true },
    });
  }

  async findById(id) {
    return prisma.brand.findUnique({
      where: { id },
      include: { products: true },
    });
  }

  async create(data) {
    return prisma.brand.create({ data });
  }

  async update(id, data) {
    return prisma.brand.update({ where: { id }, data });
  }

  async delete(id) {
    return prisma.brand.delete({ where: { id } });
  }
}

export default new BrandRepository();
