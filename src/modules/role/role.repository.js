import prisma from "../../config/prismaClient.js";

class RoleRepository {
  findAll() {
    // ikutkan daftar permission via tabel penghubung RolePermission
    return prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
      },
    });
  }

  findById(id) {
    return prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
      },
    });
  }

  create(data) {
    return prisma.role.create({ data: { name: data.name, description: data.description } });
  }

  update(id, data) {
    return prisma.role.update({ where: { id }, data });
  }

  delete(id) {
    return prisma.role.delete({ where: { id } });
  }

  // ===== permissions <-> role =====
  addPermissions(roleId, permissionIds = []) {
    const rows = permissionIds.map((pid) => ({ roleId, permissionId: pid }));
    return prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
  }

  removePermissions(roleId, permissionIds = []) {
    return prisma.rolePermission.deleteMany({
      where: { roleId, permissionId: { in: permissionIds } },
    });
  }
}

export default new RoleRepository();
