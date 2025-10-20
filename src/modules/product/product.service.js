import productRepository from "./product.repository.js";

class ProductService {
  async getAll() {
    return await productRepository.findAll();
  }

  async getById(id) {
    const product = await productRepository.findById(id);
    if (!product) throw new Error("Product not found");
    return product;
  }

  async create(data) {
    if (!data.name || !data.workspaceId)
      throw new Error("name and workspaceId are required");

    if (!data.slug)
      data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    return await productRepository.create(data);
  }

  async update(id, data) {
    if (data.name && !data.slug)
      data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return await productRepository.update(id, data);
  }

  async delete(id) {
    return await productRepository.delete(id);
  }
}

export default new ProductService();
