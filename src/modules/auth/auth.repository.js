import prisma from "../../config/prismaClient.js";

class AuthRepository {
  findUserByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  }
  createUser(data) {
    return prisma.user.create({ data });
  }
  updatePassword(userId, passwordHash) {
    return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }
}
export default new AuthRepository();
