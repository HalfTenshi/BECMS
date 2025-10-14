import contentRelationRepository from "./contentRelation.repository.js";

class ContentRelationService {
  async getAll() {
    return await contentRelationRepository.findAll();
  }

  async create(data) {
    if (!data.workspaceId || !data.fieldId || !data.fromEntryId || !data.toEntryId)
      throw new Error("workspaceId, fieldId, fromEntryId, and toEntryId required");
    return await contentRelationRepository.create(data);
  }

  async delete(id) {
    return await contentRelationRepository.delete(id);
  }
}

export default new ContentRelationService();
