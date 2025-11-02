import memberRepository from "./member.repository.js";
import prisma from "../../config/prismaClient.js";

class MemberService {
  list(workspaceId) {
    return memberRepository.list(workspaceId);
  }

  async add(workspaceId, { userId, roleId }) {
    if (!userId) throw new Error("userId is required");
    // pastikan workspace & user ada
    const [ws, user] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!ws) throw new Error("Workspace not found");
    if (!user) throw new Error("User not found");

    // unique guard
    const exists = await memberRepository.getByWorkspaceUser(workspaceId, userId);
    if (exists) throw new Error("User is already a member of this workspace");

    if (roleId) {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role || role.workspaceId !== workspaceId) throw new Error("Role not found in this workspace");
    }

    return memberRepository.add({ workspaceId, userId, roleId });
  }

  async setRole(memberId, roleId, workspaceId) {
    const member = await memberRepository.findById(memberId);
    if (!member || member.workspaceId !== workspaceId) throw new Error("Member not found in this workspace");

    if (roleId) {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role || role.workspaceId !== workspaceId) throw new Error("Role not found in this workspace");
    }
    return memberRepository.setRole(memberId, roleId);
  }

  async remove(memberId, workspaceId) {
    const member = await memberRepository.findById(memberId);
    if (!member || member.workspaceId !== workspaceId) throw new Error("Member not found in this workspace");
    await memberRepository.remove(memberId);
    return { message: "Member removed" };
  }
}

export default new MemberService();
