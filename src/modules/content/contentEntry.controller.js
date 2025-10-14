import contentEntryService from "./contentEntry.service.js";

class ContentEntryController {
  async getAll(req, res) {
    try {
      const result = await contentEntryService.getAll();
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await contentEntryService.getById(id);
      res.json(result);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  async create(req, res) {
    try {
      const result = await contentEntryService.create(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const result = await contentEntryService.update(id, req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await contentEntryService.delete(id);
      res.json({ message: "Entry deleted" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async publish(req, res) {
    try {
      const { id } = req.params;
      const result = await contentEntryService.publish(id);
      res.json({ message: "Published successfully", result });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default new ContentEntryController();
