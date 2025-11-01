import workspaceRepository from "./workspace.repository.js";

class WorkspaceService {
  async getAll() {
    return workspaceRepository.findAll();
  }

  async getById(id) {
    const workspace = await workspaceRepository.findById(id);
    if (!workspace) throw new Error("Workspace not found");
    return workspace;
  }

  async create(data) {
    if (!data.name || !data.ownerId) {
      throw new Error("Name and ownerId are required");
    }
    return workspaceRepository.create(data);
  }

  async update(id, data) {
    await this.getById(id);
    return workspaceRepository.update(id, data);
  }

  async delete(id) {
    await this.getById(id);
    return workspaceRepository.delete(id);
  }
}

export default new WorkspaceService();
