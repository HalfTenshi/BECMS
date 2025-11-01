import roleRepository from "./role.repository.js";

class RoleService {
  getAll() {
    return roleRepository.findAll();
  }

  async getById(id) {
    const role = await roleRepository.findById(id);
    if (!role) throw new Error("Role not found");
    return role;
  }

  async create(data) {
    if (!data?.name) throw new Error("Field 'name' is required");
    return roleRepository.create(data);
  }

  async update(id, data) {
    await this.getById(id);
    return roleRepository.update(id, data);
  }

  async delete(id) {
    await this.getById(id);
    return roleRepository.delete(id);
  }

  async addPermissions(roleId, permissionIds) {
    await this.getById(roleId);
    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      throw new Error("permissionIds must be a non-empty array");
    }
    await roleRepository.addPermissions(roleId, permissionIds);
    return this.getById(roleId);
  }

  async removePermissions(roleId, permissionIds) {
    await this.getById(roleId);
    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      throw new Error("permissionIds must be a non-empty array");
    }
    await roleRepository.removePermissions(roleId, permissionIds);
    return this.getById(roleId);
  }
}

export default new RoleService();
