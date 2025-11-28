// src/modules/seo/seoSupport.controller.js

import seoSupportService from "./seoSupport.service.js";

class SeoSupportController {
  async analyze(req, res, next) {
    try {
      const { title, description, slug, content, focusKeyword } = req.body || {};

      const result = await seoSupportService.analyze({
        title,
        description,
        slug,
        content,
        focusKeyword,
      });

      return res.json({
        ok: true,
        result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new SeoSupportController();
