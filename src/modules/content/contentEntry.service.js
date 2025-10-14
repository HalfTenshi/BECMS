import contentEntryRepository from "./contentEntry.repository.js";
import { generateSlug } from "../../utils/slugGenerator.js";

class ContentEntryService {
  async getAll() {
    return await contentEntryRepository.findAll();
  }

  async getById(id) {
    const entry = await contentEntryRepository.findById(id);
    if (!entry) throw new Error("Entry not found");
    return entry;
  }

  async create(data) {
    if (!data.workspaceId || !data.contentTypeId)
      throw new Error("workspaceId and contentTypeId required");

    if (data.seoTitle && !data.slug) data.slug = generateSlug(data.seoTitle);
    return await contentEntryRepository.create(data);
  }

  async update(id, data) {
    if (data.seoTitle && !data.slug) data.slug = generateSlug(data.seoTitle);
    return await contentEntryRepository.update(id, data);
  }

  async delete(id) {
    return await contentEntryRepository.delete(id);
  }

  async publish(id) {
    return await contentEntryRepository.publish(id);
  }
}

export default new ContentEntryService();
