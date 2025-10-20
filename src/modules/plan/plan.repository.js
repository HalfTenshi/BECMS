import prisma from "../../config/prismaClient.js";

class PlanRepository {
  async findAll() {
    return prisma.plan.findMany();
  }

  async findById(id) {
    return prisma.plan.findUnique({ where: { id } });
  }

  async create(data) {
    return prisma.plan.create({ data });
  }

  async update(id, data) {
    return prisma.plan.update({ where: { id }, data });
  }

  async delete(id) {
    return prisma.plan.delete({ where: { id } });
  }
}

export default new PlanRepository();
