// src/modules/docs/docs.service.js
import prisma from "../../config/prismaClient.js";

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
      return { type: "string", ...base, maxLength: field.maxLength ?? undefined, minLength: field.minLength ?? undefined };

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
      return { type: ["object", "array"], ...base, additionalProperties: true };

    case "SLUG":
      return { type: "string", ...base, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" };

    case "RELATION": {
      const many = !!cfg.many;
      const schema = many
        ? { type: "array", items: { type: "string" } }
        : { type: "string" };
      return {
        ...schema,
        ...base,
        description: `${base.description} (relation to ${cfg.targetTypeApiKey || "another content type"})`,
      };
    }

    case "MEDIA":
      return {
        type: "object",
        ...base,
        properties: {
          urls: { type: "array", items: { type: "string", pattern: "^/uploads/" } },
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
 * Menyertakan field built-in: slug, seoTitle, metaDescription, keywords, isPublished, publishedAt, timestamps
 */
function buildSchemaForType(ct) {
  const properties = {
    id: { type: "string" },
    slug: { type: "string", nullable: true },
    seoTitle: { type: "string", nullable: true },
    metaDescription: { type: "string", nullable: true },
    keywords: { type: "array", items: { type: "string" }, nullable: true },
    isPublished: { type: "boolean" },
    publishedAt: { type: "string", format: "date-time", nullable: true },
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
        ex[key] = f.config?.many ? ["entry_other_id_1", "entry_other_id_2"] : "entry_other_id";
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
   * Dok untuk satu content type berdasarkan apiKey
   */
  async buildContentTypeDoc(apiKey) {
    const ct = await prisma.contentType.findFirst({
      where: { apiKey },
      include: { fields: true, workspace: true },
    });
    if (!ct) throw new Error("ContentType not found");

    return {
      name: ct.name,
      apiKey: ct.apiKey,
      schema: buildSchemaForType(ct),
      endpoints: {
        list: `/api/public/content/${ct.apiKey}`,
        getById: `/api/public/content/${ct.apiKey}/:id`,
      },
      example: exampleForType(ct),
    };
  },

  /**
   * OpenAPI 3.1 spec untuk semua content type publish API
   */
  async buildOpenAPISpec() {
    const types = await prisma.contentType.findMany({ include: { fields: true } });

    const paths = {};
    const components = { schemas: {} };

    for (const ct of types) {
      const schemaName = `Content_${ct.apiKey}`;
      components.schemas[schemaName] = buildSchemaForType(ct);

      // List
      paths[`/api/public/content/${ct.apiKey}`] = {
        get: {
          summary: `List ${ct.name}`,
          description: `Return published ${ct.name} entries.`,
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
            // tambahkan filter umum bila perlu
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { type: "array", items: { $ref: `#/components/schemas/${schemaName}` } },
                },
              },
            },
          },
        },
      };

      // Get by ID
      paths[`/api/public/content/${ct.apiKey}/{id}`] = {
        get: {
          summary: `Get ${ct.name} by id`,
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "OK",
              content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaName}` } } },
            },
            "404": { description: "Not Found" },
          },
        },
      };
    }

    return {
      openapi: "3.1.0",
      info: { title: "BECMS Public API", version: "1.0.0" },
      paths,
      components,
    };
  },
};

export default docsService;
