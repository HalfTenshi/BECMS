import brandService from "./brand.service.js";

class BrandController {
  async getAll(req, res) {
    try {
      const brands = await brandService.getAll();
      res.json(brands);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const brand = await brandService.getById(id);
      res.json(brand);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  async create(req, res) {
    try {
      const brand = await brandService.create(req.body);
      res.status(201).json(brand);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const brand = await brandService.update(id, req.body);
      res.json(brand);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await brandService.delete(id);
      res.json({ message: "Brand deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default new BrandController();
