import userService from "./user.service.js";

class UserController {
  async getAll(req, res) {
    try {
      const data = await userService.list(req.query);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async getById(req, res) {
    try {
      const data = await userService.get(req.params.id);
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }

  async create(req, res) {
    try {
      const data = await userService.create(req.body);
      res.status(201).json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async update(req, res) {
    try {
      const data = await userService.update(req.params.id, req.body);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const data = await userService.updateStatus(req.params.id, req.body.status);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async delete(req, res) {
    try {
      const data = await userService.remove(req.params.id);
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }
}

export default new UserController();
