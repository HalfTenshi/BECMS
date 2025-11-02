import prisma from "../../config/prismaClient.js";

class MemberRepository {
  list(workspaceId) {
    return prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, pictureUrl: true, status: true } },
        role: { select: { id: true, name: true, description: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id) {
    return prisma.workspaceMember.findUnique({
      where: { id },
      include: { user: true, role: true, workspace: true },
    });
  }

  add({ workspaceId, userId, roleId }) {
    return prisma.workspaceMember.create({
      data: { workspaceId, userId, roleId },
      include: { user: true, role: true },
    });
  }

  setRole(id, roleId) {
    return prisma.workspaceMember.update({
      where: { id },
      data: { roleId },
      include: { user: true, role: true },
    });
  }

  remove(id) {
    return prisma.workspaceMember.delete({ where: { id } });
  }

  getByWorkspaceUser(workspaceId, userId) {
    return prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { user: true, role: true },
    });
  }
}

export default new MemberRepository();
