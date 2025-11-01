import prisma from "../../config/prismaClient.js";

class PermissionRepository {
  findAll() {
    return prisma.permission.findMany();
  }

  findById(id) {
    return prisma.permission.findUnique({ where: { id } });
  }

  create(data) {
    return prisma.permission.create({ data: { name: data.name, action: data.action, module: data.module, description: data.description } });
  }

  update(id, data) {
    return prisma.permission.update({ where: { id }, data });
  }

  delete(id) {
    return prisma.permission.delete({ where: { id } });
  }
}

export default new PermissionRepository();
