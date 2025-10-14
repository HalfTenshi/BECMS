import contentTypeService from "./contentType.service.js";

class ContentTypeController {
  async getAll(req, res) {
    try {
      const result = await contentTypeService.getAll();
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await contentTypeService.getById(id);
      res.json(result);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  async create(req, res) {
    try {
      const result = await contentTypeService.create(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const result = await contentTypeService.update(id, req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await contentTypeService.delete(id);
      res.json({ message: "Content Type deleted" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default new ContentTypeController();
