import permissionService from "./permission.service.js";

class PermissionController {
  async getAll(req, res) {
    try {
      const data = await permissionService.getAll();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  async getById(req, res) {
    try {
      const data = await permissionService.getById(req.params.id);
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }

  async create(req, res) {
    try {
      const data = await permissionService.create(req.body);
      res.status(201).json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async update(req, res) {
    try {
      const data = await permissionService.update(req.params.id, req.body);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async delete(req, res) {
    try {
      await permissionService.delete(req.params.id);
      res.json({ message: "Permission deleted" });
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }
}

export default new PermissionController();
