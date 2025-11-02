import memberService from "./member.service.js";

class MemberController {
  async list(req, res) {
    try {
      const data = await memberService.list(req.params.workspaceId);
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async add(req, res) {
    try {
      const data = await memberService.add(req.params.workspaceId, req.body);
      res.status(201).json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async setRole(req, res) {
    try {
      const data = await memberService.setRole(
        req.params.memberId,
        req.body.roleId ?? null,
        req.params.workspaceId
      );
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async remove(req, res) {
    try {
      const data = await memberService.remove(req.params.memberId, req.params.workspaceId);
      res.json(data);
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  }
}

export default new MemberController();
