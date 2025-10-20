import planRepository from "./plan.repository.js";

class PlanService {
  async getAll() {
    // Ambil semua plan
    return await planRepository.findAll();
  }

  async getById(id) {
    // Ambil satu plan berdasarkan id
    const plan = await planRepository.findById(id);
    if (!plan) throw new Error("Plan not found");
    return plan;
  }

  async create(data) {
    // Validasi data wajib
    if (!data.name) throw new Error("Plan name is required");

    // Default harga jika tidak diisi
    if (!data.monthlyPrice) data.monthlyPrice = 0;
    if (!data.yearlyPrice) data.yearlyPrice = 0;

    return await planRepository.create({
      name: data.name,
      monthlyPrice: data.monthlyPrice,
      yearlyPrice: data.yearlyPrice,
      maxMembers: data.maxMembers,
      maxContentTypes: data.maxContentTypes,
      maxEntries: data.maxEntries,
    });
  }

  async update(id, data) {
    // Update plan berdasarkan id
    const existing = await planRepository.findById(id);
    if (!existing) throw new Error("Plan not found");

    return await planRepository.update(id, {
      name: data.name ?? existing.name,
      monthlyPrice: data.monthlyPrice ?? existing.monthlyPrice,
      yearlyPrice: data.yearlyPrice ?? existing.yearlyPrice,
      maxMembers: data.maxMembers ?? existing.maxMembers,
      maxContentTypes: data.maxContentTypes ?? existing.maxContentTypes,
      maxEntries: data.maxEntries ?? existing.maxEntries,
    });
  }

  async delete(id) {
    // Hapus plan berdasarkan id
    const existing = await planRepository.findById(id);
    if (!existing) throw new Error("Plan not found");
    return await planRepository.delete(id);
  }
}

export default new PlanService();
