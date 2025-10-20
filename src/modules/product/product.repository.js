import prisma from "../../config/prismaClient.js";

class ProductRepository {
  async findAll() {
    return prisma.product.findMany({
      include: { brand: true, category: true, workspace: true },
    });
  }

  async findById(id) {
    return prisma.product.findUnique({
      where: { id },
      include: { brand: true, category: true },
    });
  }

  async create(data) {
    return prisma.product.create({ data });
  }

  async update(id, data) {
    return prisma.product.update({ where: { id }, data });
  }

  async delete(id) {
    return prisma.product.delete({ where: { id } });
  }
}

export default new ProductRepository();
