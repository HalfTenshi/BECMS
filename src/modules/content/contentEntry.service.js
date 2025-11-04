import contentEntryRepository from "./contentEntry.repository.js";
import prisma from "../../config/prismaClient.js";
import { generateSlug } from "../../utils/slugGenerator.js";
import { enforceOnPayload } from "./entry.validation.js";

class ContentEntryService {
  // ===================== READ =====================
  async getAll() {
    return await contentEntryRepository.findAll();
  }

  async getById(id) {
    const entry = await contentEntryRepository.findById(id);
    if (!entry) throw new Error("Entry not found");
    return entry;
  }

  // ===================== CREATE =====================
  /**
   * data:
   * {
   *   workspaceId: string,
   *   contentTypeId: string,
   *   values: [{ apiKey, value }],           // nilai field dinamis
   *   slug?, seoTitle?, metaDescription?, keywords?, isPublished?, publishedAt?,
   *   createdById?, updatedById?
   * }
   */
  async create(data) {
    if (!data.workspaceId || !data.contentTypeId) {
      throw new Error("workspaceId and contentTypeId required");
    }

    // 1) Enforce validasi terhadap definisi ContentField (required/unique/min/max/type/slugFrom/RELATION)
    const { fieldValues, relations, generated } = await enforceOnPayload({
      contentTypeId: data.contentTypeId,
      entryId: null,
      values: data.values || [],
    });

    // 2) Siapkan slug (prioritas: explicit slug -> generate dari seoTitle -> generate dari slugFrom)
    let finalSlug = data.slug ?? null;
    if (!finalSlug && data.seoTitle) {
      finalSlug = generateSlug(data.seoTitle);
    }
    if (!finalSlug && generated.slug) {
      finalSlug = generated.slug;
    }

    // 3) Tulis entry + FieldValue + ContentRelation dalam 1 transaksi
    const entry = await prisma.$transaction(async (tx) => {
      // 3a) Create entry
      const created = await tx.contentEntry.create({
        data: {
          workspaceId: data.workspaceId,
          contentTypeId: data.contentTypeId,
          slug: finalSlug,
          seoTitle: data.seoTitle ?? null,
          metaDescription: data.metaDescription ?? null,
          keywords: data.keywords ?? [],
          isPublished: !!data.isPublished,
          publishedAt: data.publishedAt ?? null,
          createdById: data.createdById ?? null,
          updatedById: data.updatedById ?? null,
        },
      });

      // 3b) Field values (TEXT/RICH_TEXT/NUMBER/BOOLEAN/DATE/JSON/SLUG)
      for (const fv of fieldValues) {
        await tx.fieldValue.create({
          data: {
            entryId: created.id,
            fieldId: fv.fieldId,
            [fv.key]: fv.value,
          },
        });
      }

      // 3c) Relations (RELATION → ContentRelation)
      for (const r of relations) {
        for (const toId of r.targetIds) {
          await tx.contentRelation.create({
            data: {
              workspaceId: data.workspaceId,
              fieldId: r.fieldId,
              fromEntryId: created.id,
              toEntryId: toId,
            },
          });
        }
      }

      return created;
    });

    return entry;
  }

  // ===================== UPDATE =====================
  /**
   * data:
   * {
   *   values?: [{ apiKey, value }],      // hanya field yang ingin diubah
   *   slug?, seoTitle?, metaDescription?, keywords?, isPublished?, publishedAt?,
   *   updatedById?
   * }
   */
  async update(id, data) {
    const existing = await contentEntryRepository.findById(id);
    if (!existing) throw new Error("Entry not found");

    // 1) Siapkan slug bila tidak diberikan
    let finalSlug = data.slug ?? existing.slug ?? null;
    if (!data.slug && data.seoTitle && !existing.slug) {
      finalSlug = generateSlug(data.seoTitle);
    }

    // 2) Validasi & mapping ulang hanya untuk field yang dikirim
    let fieldValues = [];
    let relations = [];
    if (Array.isArray(data.values) && data.values.length > 0) {
      const enforced = await enforceOnPayload({
        contentTypeId: existing.contentTypeId,
        entryId: id, // agar unique check mengecualikan dirinya
        values: data.values,
      });
      fieldValues = enforced.fieldValues;
      relations = enforced.relations;

      // Kalau slug digenerate dari slugFrom dan entry sebelumnya belum punya slug, terapkan
      if (!finalSlug && enforced.generated?.slug) {
        finalSlug = enforced.generated.slug;
      }
    }

    // 3) Transaksi update: meta entry + replace FieldValue yg dikirim + replace Relation untuk field yg dikirim
    const updated = await prisma.$transaction(async (tx) => {
      // 3a) Update meta entry
      const saved = await tx.contentEntry.update({
        where: { id },
        data: {
          slug: finalSlug,
          seoTitle: data.seoTitle ?? existing.seoTitle,
          metaDescription: data.metaDescription ?? existing.metaDescription,
          keywords: data.keywords ?? existing.keywords,
          isPublished: typeof data.isPublished === "boolean" ? data.isPublished : existing.isPublished,
          publishedAt: data.publishedAt ?? existing.publishedAt,
          updatedById: data.updatedById ?? existing.updatedById,
        },
      });

      // 3b) Jika ada perubahan values, replace per-fieldId yang dikirim
      if (fieldValues.length > 0) {
        const fieldIdsChanged = [...new Set(fieldValues.map((fv) => fv.fieldId))];

        // Hapus value lama untuk field yang berubah
        await tx.fieldValue.deleteMany({
          where: { entryId: id, fieldId: { in: fieldIdsChanged } },
        });

        // Tulis value baru
        for (const fv of fieldValues) {
          await tx.fieldValue.create({
            data: {
              entryId: id,
              fieldId: fv.fieldId,
              [fv.key]: fv.value,
            },
          });
        }
      }

      // 3c) Jika ada perubahan RELATION, replace hubungan untuk field yang dikirim
      if (relations.length > 0) {
        const relFieldIds = [...new Set(relations.map((r) => r.fieldId))];

        await tx.contentRelation.deleteMany({
          where: { fromEntryId: id, fieldId: { in: relFieldIds } },
        });

        for (const r of relations) {
          for (const toId of r.targetIds) {
            await tx.contentRelation.create({
              data: {
                workspaceId: existing.workspaceId,
                fieldId: r.fieldId,
                fromEntryId: id,
                toEntryId: toId,
              },
            });
          }
        }
      }

      return saved;
    });

    return updated;
  }

  // ===================== DELETE / PUBLISH =====================
  async delete(id) {
    return await contentEntryRepository.delete(id);
  }

  async publish(id) {
    return await contentEntryRepository.publish(id);
  }
}

export default new ContentEntryService();
