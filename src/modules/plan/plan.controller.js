import planService from "./plan.service.js";

class PlanController {
  async getAll(req, res) {
    try {
      const plans = await planService.getAll();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const plan = await planService.getById(id);
      res.json(plan);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  async create(req, res) {
    try {
      const newPlan = await planService.create(req.body);
      res.status(201).json({
        message: "Plan created successfully",
        plan: newPlan,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const updatedPlan = await planService.update(id, req.body);
      res.json({
        message: "Plan updated successfully",
        plan: updatedPlan,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await planService.delete(id);
      res.json({ message: "Plan deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default new PlanController();
