import contentEntryService from "./contentEntry.service.js";

class ContentEntryController {
  // ===================== READ =====================
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
      const { include = "", depth = 0 } = req.query;
      const workspaceId = req.workspace?.id || req.headers["x-workspace-id"];

      // Jika client meminta include=relations/depth, gunakan service khusus
      if (include) {
        const scope = req.baseUrl.includes("/api/admin/") ? "admin" : "public";
        const result = await contentEntryService.getByIdWithInclude({
          id,
          workspaceId,
          include,
          depth: Number(depth) || 0,
          scope,
        });
        return res.json(result);
      }

      // Fallback perilaku lama
      const result = await contentEntryService.getById(id);
      res.json(result);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  // ===================== WRITE =====================
  /**
   * Body contoh:
   * {
   *   "contentTypeId": "<ct-id>",
   *   "values": [{ "apiKey": "title", "value": "Hello" }],
   *   "seoTitle": "Judul SEO",
   *   "metaDescription": "Ringkasan maksimal 160 karakter",
   *   "keywords": ["cms","seo"] // atau "cms,seo"
   *   "slug": "judul-seo",
   *   "isPublished": false,
   *   "publishedAt": null
   * }
   */
  async create(req, res) {
    try {
      const workspaceId = req.workspace?.id || req.headers["x-workspace-id"];

      // Pastikan field SEO ikut diteruskan
      const payload = {
        ...req.body,
        workspaceId,
        // metaDescription & keywords akan dinormalisasi di service (≤160, array)
        metaDescription: req.body?.metaDescription,
        keywords: req.body?.keywords,
      };

      const result = await contentEntryService.create(payload);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;

      // Pastikan field SEO ikut diteruskan saat update juga
      const payload = {
        ...req.body,
        metaDescription: req.body?.metaDescription,
        keywords: req.body?.keywords, // boleh array atau "a,b,c" (service akan normalisasi)
      };

      const result = await contentEntryService.update(id, payload);
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

  // ===================== UTIL / RELATION =====================
  // ✅ Listing entries per ContentType + filter relasi M2M (fieldId + related)
  // GET /api/admin/content/:contentType/entries?fieldId=&related=&page=&pageSize=
  async listByContentType(req, res) {
    try {
      const workspaceId = req.workspace?.id || req.headers["x-workspace-id"];
      const { contentType } = req.params; // apiKey ContentType
      const { fieldId, related, page = 1, pageSize = 20 } = req.query;

      const result = await contentEntryService.listByContentTypeWithM2M({
        workspaceId,
        contentTypeApiKey: contentType,
        fieldId,
        related,
        page,
        pageSize,
      });

      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  // 🔎 Util search (public & admin)
  // GET /api/content/:contentType/search
  // GET /api/admin/content/:contentType/search
  async searchForRelation(req, res) {
    try {
      const workspaceId = req.workspace?.id || req.headers["x-workspace-id"];
      const { contentType } = req.params;
      const {
        q = "",
        page = 1,
        pageSize = 10,
        sort = "publishedAt:desc",
      } = req.query;

      const scope = req.baseUrl.includes("/api/admin/") ? "admin" : "public";

      const out = await contentEntryService.searchForRelation({
        workspaceId,
        contentTypeApiKey: contentType,
        q,
        page,
        pageSize,
        sort,
        scope,
      });

      res.json(out);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

export default new ContentEntryController();
