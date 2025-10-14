import fieldValueService from "./fieldValue.service.js";

class FieldValueController {
  async getByEntry(req, res) {
    try {
      const { entryId } = req.params;
      const result = await fieldValueService.getByEntry(entryId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async create(req, res) {
    try {
      const result = await fieldValueService.create(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const result = await fieldValueService.update(id, req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await fieldValueService.delete(id);
      res.json({ message: "Field value deleted" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default new FieldValueController();
