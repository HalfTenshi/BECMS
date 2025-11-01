import roleService from "./role.service.js";

class RoleController {
  async getAll(req, res) {
    try {
      const data = await roleService.getAll();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }

  async getById(req, res) {
    try {
      const data = await roleService.getById(req.params.id);
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }

  async create(req, res) {
    try {
      const data = await roleService.create(req.body);
      res.status(201).json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async update(req, res) {
    try {
      const data = await roleService.update(req.params.id, req.body);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async delete(req, res) {
    try {
      await roleService.delete(req.params.id);
      res.json({ message: "Role deleted" });
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }

  // ==== role <-> permissions ====
  async addPermissions(req, res) {
    try {
      const roleId = req.params.id;
      const { permissionIds } = req.body;
      const data = await roleService.addPermissions(roleId, permissionIds);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async removePermissions(req, res) {
    try {
      const roleId = req.params.id;
      const { permissionIds } = req.body;
      const data = await roleService.removePermissions(roleId, permissionIds);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
}

export default new RoleController();
