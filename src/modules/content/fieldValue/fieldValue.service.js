import fieldValueRepository from "./fieldValue.repository.js";

class FieldValueService {
  async getByEntry(entryId) {
    return await fieldValueRepository.findByEntry(entryId);
  }

  async create(data) {
    if (!data.entryId || !data.fieldId)
      throw new Error("entryId and fieldId required");
    return await fieldValueRepository.create(data);
  }

  async update(id, data) {
    return await fieldValueRepository.update(id, data);
  }

  async delete(id) {
    return await fieldValueRepository.delete(id);
  }
}

export default new FieldValueService();
