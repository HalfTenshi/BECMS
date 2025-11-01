import permissionRepository from "./permission.repository.js";

class PermissionService {
  getAll() {
    return permissionRepository.findAll();
  }

  async getById(id) {
    const p = await permissionRepository.findById(id);
    if (!p) throw new Error("Permission not found");
    return p;
  }

  async create(data) {
    if (!data?.name || !data?.action || !data?.module) {
      throw new Error("Fields 'name', 'action', and 'module' are required");
    }
    return permissionRepository.create(data);
  }

  async update(id, data) {
    await this.getById(id);
    return permissionRepository.update(id, data);
  }

  async delete(id) {
    await this.getById(id);
    return permissionRepository.delete(id);
  }
}

export default new PermissionService();
