import brandRepository from "./brand.repository.js";

class BrandService {
  async getAll() {
    return await brandRepository.findAll();
  }

  async getById(id) {
    const brand = await brandRepository.findById(id);
    if (!brand) throw new Error("Brand not found");
    return brand;
  }

  async create(data) {
    if (!data.name || !data.workspaceId)
      throw new Error("name and workspaceId are required");

    // buat slug otomatis dari nama
    data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return await brandRepository.create(data);
  }

  async update(id, data) {
    if (data.name && !data.slug)
      data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return await brandRepository.update(id, data);
  }

  async delete(id) {
    return await brandRepository.delete(id);
  }
}

export default new BrandService();
