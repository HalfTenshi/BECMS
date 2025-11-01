import prisma from "../../config/prismaClient.js";

class WorkspaceRepository {
  async findAll() {
    return prisma.workspace.findMany({
      include: { members: true },
    });
  }

  async findById(id) {
    return prisma.workspace.findUnique({
      where: { id },
      include: { members: true },
    });
  }

  async create(data) {
    return prisma.workspace.create({
      data: {
        name: data.name,
        description: data.description,
        ownerId: data.ownerId,
      },
    });
  }

  async update(id, data) {
    return prisma.workspace.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    return prisma.workspace.delete({
      where: { id },
    });
  }
}

export default new WorkspaceRepository();
