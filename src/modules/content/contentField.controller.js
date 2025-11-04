import service from "./contentField.service.js";

class ContentFieldController {
  async list(req, res, next) {
    try {
      const data = await service.list({
        contentTypeId: req.params.contentTypeId,
        workspaceId: req.workspaceId,
      });
      res.json({ data });
    } catch (e) { next(e); }
  }

  async detail(req, res, next) {
    try {
      const data = await service.detail({
        contentTypeId: req.params.contentTypeId,
        fieldId: req.params.fieldId,
        workspaceId: req.workspaceId,
      });
      res.json({ data });
    } catch (e) { next(e); }
  }

  async create(req, res, next) {
    try {
      const data = await service.create({
        contentTypeId: req.params.contentTypeId,
        workspaceId: req.workspaceId,
        payload: req.body,
      });
      res.status(201).json({ data });
    } catch (e) { next(e); }
  }

  async update(req, res, next) {
    try {
      const data = await service.update({
        contentTypeId: req.params.contentTypeId,
        fieldId: req.params.fieldId,
        workspaceId: req.workspaceId,
        payload: req.body,
      });
      res.json({ data });
    } catch (e) { next(e); }
  }

  async remove(req, res, next) {
    try {
      const data = await service.remove({
        contentTypeId: req.params.contentTypeId,
        fieldId: req.params.fieldId,
        workspaceId: req.workspaceId,
      });
      res.json(data);
    } catch (e) { next(e); }
  }

  async reorder(req, res, next) {
    try {
      const data = await service.reorder({
        contentTypeId: req.params.contentTypeId,
        workspaceId: req.workspaceId,
        items: req.body.items,
      });
      res.json(data);
    } catch (e) { next(e); }
  }
}

export default new ContentFieldController();
