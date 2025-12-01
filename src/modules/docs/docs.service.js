// src/modules/docs/docs.service.js
import prisma from "../../config/prismaClient.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

/**
 * Ubah definisi ContentField → JSON Schema (OpenAPI 3.1 compatible)
 */
function toJSONSchema(field) {
  const base = {
    description: field.label || field.name || field.apiKey,
    nullable: !field.isRequired,
  };
  const cfg = field.config || {};

  switch (field.type) {
    case "TEXT":
      return {
        type: "string",
        ...base,
        maxLength: field.maxLength ?? undefined,
        minLength: field.minLength ?? undefined,
      };

    case "RICH_TEXT":
      return { type: "string", ...base };

    case "NUMBER":
      return {
        type: "number",
        ...base,
        minimum: field.minNumber ?? undefined,
        maximum: field.maxNumber ?? undefined,
      };

    case "BOOLEAN":
      return { type: "boolean", ...base };

    case "DATE":
      return { type: "string", format: "date-time", ...base };

    case "JSON":
      return {
        type: ["object", "array"],
        ...base,
        additionalProperties: true,
      };

    case "SLUG":
      return {
        type: "string",
        ...base,
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      };

    case "RELATION": {
      const many = !!cfg.many;
      const schema = many
        ? { type: "array", items: { type: "string" } }
        : { type: "string" };
      return {
        ...schema,
        ...base,
        description: `${base.description} (relation to ${
          cfg.targetTypeApiKey || "another content type"
        })`,
      };
    }

    case "MEDIA":
      return {
        type: "object",
        ...base,
        properties: {
          urls: {
            type: "array",
            items: { type: "string", pattern: "^/uploads/" },
          },
          files: {
            type: "array",
            items: {
              type: "object",
              properties: {
                url: { type: "string" },
                mime: { type: "string" },
                size: { type: "integer" },
              },
              additionalProperties: true,
            },
          },
        },
        required: field.isRequired ? ["urls"] : [],
        additionalProperties: false,
      };

    default:
      // fallback ke string
      return { type: "string", ...base };
  }
}

/**
 * Bangun JSON Schema level entry untuk sebuah ContentType
 * Menyertakan field built-in:
 *  - slug, seoTitle, metaDescription, keywords
 *  - isPublished, publishedAt, timestamps
 */
function buildSchemaForType(ct) {
  const properties = {
    id: { type: "string" },
    slug: { type: "string", nullable: true },
    seoTitle: { type: "string", nullable: true },
    metaDescription: { type: "string", nullable: true },
    keywords: {
      type: "array",
      items: { type: "string" },
      nullable: true,
    },
    isPublished: { type: "boolean" },
    publishedAt: {
      type: "string",
      format: "date-time",
      nullable: true,
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  };

  // field custom -> properti dengan key = apiKey (fallback ke name)
  for (const f of ct.fields) {
    const key = f.apiKey || f.name;
    properties[key] = toJSONSchema(f);
  }

  return {
    type: "object",
    properties,
    required: ["id", "isPublished", "createdAt", "updatedAt"],
    additionalProperties: true,
  };
}

/**
 * Contoh payload entry untuk satu ContentType
 */
function exampleForType(ct) {
  const ex = {
    id: "entry_123",
    slug: "example-slug",
    seoTitle: "Example Title",
    metaDescription: "Short description...",
    keywords: ["tag1", "tag2"],
    isPublished: true,
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  for (const f of ct.fields) {
    const key = f.apiKey || f.name;
    switch (f.type) {
      case "TEXT":
      case "RICH_TEXT":
        ex[key] = "Sample text";
        break;
      case "NUMBER":
        ex[key] = 123;
        break;
      case "BOOLEAN":
        ex[key] = true;
        break;
      case "DATE":
        ex[key] = new Date().toISOString();
        break;
      case "JSON":
        ex[key] = { any: "object" };
        break;
      case "SLUG":
        ex[key] = "sample-slug";
        break;
      case "RELATION":
        ex[key] = f.config?.many
          ? ["entry_other_id_1", "entry_other_id_2"]
          : "entry_other_id";
        break;
      case "MEDIA":
        ex[key] = { urls: ["/uploads/example.png"] };
        break;
      default:
        ex[key] = null;
    }
  }

  return ex;
}

const docsService = {
  /**
   * Dok untuk satu ContentType berdasarkan apiKey.
   *
   * Menjelaskan juga query params relasi di endpoints:
   *  - relations, relationsDepth, relationsSummary
   */
  async buildContentTypeDoc(apiKey) {
    const ct = await prisma.contentType.findFirst({
      where: { apiKey },
      include: { fields: true, workspace: true },
    });
    if (!ct) {
      throw ApiError.notFound("ContentType not found", {
        code: ERROR_CODES.DOCS_NOT_FOUND,
        reason: "DOCS_CONTENT_TYPE_NOT_FOUND",
        resource: "DOCS",
        details: { apiKey },
      });
    }

    const schema = buildSchemaForType(ct);

    return {
      name: ct.name,
      apiKey: ct.apiKey,
      schema,
      endpoints: {
        list: {
          method: "GET",
          path: `/api/public/content/${ct.apiKey}`,
          description:
            "List published entries dengan dukungan filter SEO & relasi.",
          query: {
            q: "optional search (seoTitle/slug/metaDescription)",
            page: "integer, default 1",
            pageSize: "integer, default 10, max 100",
            sort: 'mis. "publishedAt:desc", "seoTitle:asc"',
            include:
              'optional: "values,relations" (comma-separated) untuk include field values & relasi',
            relations:
              'optional: aktifkan ekspansi relasi. Contoh: "1" / "true" / "relations"',
            relationsDepth:
              "optional: integer 1..5 (default 1). Nilai di luar range akan di-clamp.",
            relationsSummary:
              'optional: "basic" | "full" (default "basic"). "full" meng-include values pada target.',
          },
          responseExample: {
            rows: [exampleForType(ct)],
            total: 1,
            page: 1,
            pageSize: 10,
            pages: 1,
          },
        },
        getBySlug: {
          method: "GET",
          path: `/api/public/content/${ct.apiKey}/{slug}`,
          description:
            "Detail satu entry published, dengan dukungan include values & relasi.",
          pathParams: {
            slug: "slug entry",
          },
          query: {
            include:
              'optional: "values,relations" (comma-separated). "values" untuk field values, "relations" untuk relasi.',
            relations:
              'optional: whitelist field relasi via apiKey, contoh "author,brand". Jika kosong → semua field RELATION.',
            relationsDepth:
              "optional: integer 1..5 (default 1). Dipakai untuk ekspansi nested relasi.",
            relationsSummary:
              'optional: "basic" | "full" (default "basic"). "full" meng-include values pada target.',
          },
          responseExample: exampleForType(ct),
        },
      },
      example: exampleForType(ct),
    };
  },

  /**
   * OpenAPI 3.1 spec untuk semua ContentType yang punya public API.
   *
   * Termasuk dokumentasi:
   *  - Query params relasi: relations, relationsDepth, relationsSummary
   *  - Response wrapper: { rows, total, page, pageSize, pages }
   */
  async buildOpenAPISpec() {
    const types = await prisma.contentType.findMany({
      include: { fields: true },
    });

    const paths = {};
    const components = { schemas: {} };

    for (const ct of types) {
      const schemaName = `Content_${ct.apiKey}`;
      const listSchemaName = `Content_${ct.apiKey}_ListResponse`;

      // Schema entry
      components.schemas[schemaName] = buildSchemaForType(ct);

      // Schema list response (rows + meta pagination)
      components.schemas[listSchemaName] = {
        type: "object",
        properties: {
          rows: {
            type: "array",
            items: { $ref: `#/components/schemas/${schemaName}` },
          },
          total: { type: "integer", minimum: 0 },
          page: { type: "integer", minimum: 1 },
          pageSize: { type: "integer", minimum: 1 },
          pages: { type: "integer", minimum: 1 },
        },
        required: ["rows", "total", "page", "pageSize", "pages"],
      };

      // GET /api/public/content/:contentType
      paths[`/api/public/content/${ct.apiKey}`] = {
        get: {
          tags: ["Public Content"],
          summary: `List ${ct.name}`,
          description:
            "Return published entries untuk content type ini. Mendukung SEO search + ekspansi relasi.",
          parameters: [
            {
              name: "q",
              in: "query",
              required: false,
              description:
                "optional search (seoTitle/slug/metaDescription, case-insensitive)",
              schema: { type: "string" },
            },
            {
              name: "page",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, default: 1 },
            },
            {
              name: "pageSize",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            },
            {
              name: "sort",
              in: "query",
              required: false,
              description:
                'mis. "publishedAt:desc", "publishedAt:asc", "seoTitle:asc"',
              schema: { type: "string", default: "publishedAt:desc" },
            },
            {
              name: "include",
              in: "query",
              required: false,
              description:
                'comma-separated: "values", "relations" (contoh: "values,relations")',
              schema: { type: "string" },
            },
            {
              name: "relations",
              in: "query",
              required: false,
              description:
                'aktifkan ekspansi relasi dan/atau whitelist field RELATION via apiKey, mis. "author,brand". Jika kosong → semua RELATION field.',
              schema: { type: "string" },
            },
            {
              name: "relationsDepth",
              in: "query",
              required: false,
              description:
                "kedalaman ekspansi relasi (nested), 1..5; nilai di luar range akan di-clamp.",
              schema: {
                type: "integer",
                minimum: 1,
                maximum: 5,
                default: 1,
              },
            },
            {
              name: "relationsSummary",
              in: "query",
              required: false,
              description:
                '"basic" (ringkas) atau "full" (include values di target). Default "basic".',
              schema: {
                type: "string",
                enum: ["basic", "full"],
                default: "basic",
              },
            },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    $ref: `#/components/schemas/${listSchemaName}`,
                  },
                },
              },
            },
          },
        },
      };

      // GET /api/public/content/:contentType/:slug
      paths[`/api/public/content/${ct.apiKey}/{slug}`] = {
        get: {
          tags: ["Public Content"],
          summary: `Get ${ct.name} by slug`,
          description:
            "Detail satu entry published berdasarkan slug. Mendukung include values & ekspansi relasi.",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "include",
              in: "query",
              required: false,
              description:
                'comma-separated: "values", "relations" (contoh: "values,relations")',
              schema: { type: "string" },
            },
            {
              name: "relations",
              in: "query",
              required: false,
              description:
                'whitelist field RELATION via apiKey, mis. "author,brand". Jika kosong → semua RELATION field.',
              schema: { type: "string" },
            },
            {
              name: "relationsDepth",
              in: "query",
              required: false,
              description:
                "kedalaman ekspansi relasi (nested), 1..5; nilai di luar range akan di-clamp.",
              schema: {
                type: "integer",
                minimum: 1,
                maximum: 5,
                default: 1,
              },
            },
            {
              name: "relationsSummary",
              in: "query",
              required: false,
              description:
                '"basic" (ringkas) atau "full" (include values di target). Default "basic".',
              schema: {
                type: "string",
                enum: ["basic", "full"],
                default: "basic",
              },
            },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    $ref: `#/components/schemas/${schemaName}`,
                  },
                },
              },
            },
            "404": { description: "Not Found" },
          },
        },
      };
    }

    return {
      openapi: "3.1.0",
      info: {
        title: "BECMS Public Content API",
        version: "1.0.0",
        description:
          "Public API untuk mengakses published content entries, termasuk dukungan SEO & relasi (relations, relationsDepth, relationsSummary).",
      },
      paths,
      components,
    };
  },
};

export default docsService;
