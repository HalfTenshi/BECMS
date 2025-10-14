import contentTypeRepository from "./contentType.repository.js";

class ContentTypeService {
  async getAll() {
    return await contentTypeRepository.findAll();
  }

  async getById(id) {
    return await contentTypeRepository.findById(id);
  }

  async create(data) {
    if (!data.name || !data.apiKey || !data.workspaceId)
      throw new Error("name, apiKey, and workspaceId are required");
    return await contentTypeRepository.create(data);
  }

  async update(id, data) {
    return await contentTypeRepository.update(id, data);
  }

  async delete(id) {
    return await contentTypeRepository.delete(id);
  }
}

export default new ContentTypeService();
