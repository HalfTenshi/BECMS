import workspaceService from "./workspace.service.js";

class WorkspaceController {
  async getAll(req, res) {
    try {
      const data = await workspaceService.getAll();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async getById(req, res) {
    try {
      const data = await workspaceService.getById(req.params.id);
      res.json(data);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }

  async create(req, res) {
    try {
      const data = await workspaceService.create(req.body);
      res.status(201).json(data);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async update(req, res) {
    try {
      const data = await workspaceService.update(req.params.id, req.body);
      res.json(data);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async delete(req, res) {
    try {
      await workspaceService.delete(req.params.id);
      res.json({ message: "Workspace deleted" });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }
}

export default new WorkspaceController();
