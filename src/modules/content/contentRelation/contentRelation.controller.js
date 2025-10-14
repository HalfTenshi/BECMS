import contentRelationService from "./contentRelation.service.js";

class ContentRelationController {
  async getAll(req, res) {
    try {
      const result = await contentRelationService.getAll();
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async create(req, res) {
    try {
      const result = await contentRelationService.create(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await contentRelationService.delete(id);
      res.json({ message: "Relation deleted" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default new ContentRelationController();
