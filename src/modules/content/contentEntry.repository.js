// src/modules/content/contentEntry.repository.js
import prisma from "../../config/prismaClient.js";

class ContentEntryRepository {
  async findAll({
    where = {},
    include = { contentType: true, values: true },
    orderBy = { createdAt: "desc" },
    skip,
    take,
  } = {}) {
    return prisma.contentEntry.findMany({
      where,
      include,
      orderBy,
      skip,
      take,
    });
  }

  async findById(
    id,
    workspaceId,
    include = { contentType: true, values: true }
  ) {
    return prisma.contentEntry.findFirst({
      where: {
        id,
        ...(workspaceId ? { workspaceId } : {}),
      },
      include,
    });
  }

  /**
   * Helper khusus untuk kebutuhan SEO preview.
   * Mengambil hanya field-field yang relevan untuk SERP:
   *  - id, workspaceId, contentTypeId
   *  - slug, seoTitle, metaDescription, keywords
   *  - isPublished, publishedAt
   *
   * workspaceId opsional, tapi disarankan diisi untuk multi-tenant safety.
   */
  async findSeoById(entryId, workspaceId) {
    if (!entryId) return null;

    return prisma.contentEntry.findFirst({
      where: {
        id: entryId,
        ...(workspaceId ? { workspaceId } : {}),
      },
      select: {
        id: true,
        workspaceId: true,
        contentTypeId: true,
        slug: true,
        seoTitle: true,
        metaDescription: true,
        keywords: true,
        isPublished: true,
        publishedAt: true,
      },
    });
  }

  /**
   * Cek apakah slug sudah dipakai di workspace + contentType tertentu.
   *
   * - enforce unik per (workspaceId, contentTypeId, slug),
   *   sesuai dengan constraint Prisma:
   *     @@unique([workspaceId, contentTypeId, slug])
   *
   * - excludeId: untuk update (abaikan entry dirinya sendiri)
   */
  async isSlugTaken(workspaceId, contentTypeId, slug, excludeId) {
    if (!workspaceId || !contentTypeId || !slug) return null;
    return prisma.contentEntry.findFirst({
      where: {
        workspaceId,
        contentTypeId,
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  }

  /**
   * Create entry + SEO fields (metaDescription, keywords)
   * NOTE: Normalisasi dan limit 160 char dilakukan di Service,
   * repository menerima data yang sudah beres.
   */
  async create(data) {
    return prisma.contentEntry.create({
      data: {
        workspaceId: data.workspaceId,
        contentTypeId: data.contentTypeId,
        slug: data.slug ?? null,
        seoTitle: data.seoTitle ?? null,
        metaDescription: data.metaDescription ?? null, // ≤160 sudah dijaga di service
        keywords: Array.isArray(data.keywords) ? data.keywords : [], // backup
        isPublished: !!data.isPublished,
        publishedAt: data.publishedAt ?? null,
        createdById: data.createdById ?? null,
        updatedById: data.updatedById ?? null,
      },
    });
  }

  /**
   * Update entry + SEO fields (metaDescription, keywords)
   */
  async update(id, data) {
    return prisma.contentEntry.update({
      where: { id },
      data: {
        slug: data.slug ?? undefined,
        seoTitle: data.seoTitle ?? undefined,
        metaDescription: data.metaDescription ?? undefined, // ≤160 sudah dijaga di service
        keywords: Array.isArray(data.keywords) ? data.keywords : undefined,
        isPublished:
          typeof data.isPublished === "boolean" ? data.isPublished : undefined,
        publishedAt: data.publishedAt ?? undefined,
        updatedById: data.updatedById ?? undefined,
      },
    });
  }

  async delete(id, workspaceId) {
    return prisma.contentEntry.delete({
      where: { id },
    });
    // NOTE: workspaceId sudah di-check di service (findByIdInWorkspace)
  }

  async publish(id, workspaceId) {
    return prisma.contentEntry.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
    });
    // NOTE: workspaceId sudah di-check di service
  }

  /**
   * Bulk clear SEO fields untuk semua entry pada ContentType tertentu di workspace tertentu.
   * Dipanggil ketika ContentType.seoEnabled dimatikan (true → false).
   */
  async clearSeoFieldsByContentType(workspaceId, contentTypeId) {
    if (!workspaceId || !contentTypeId) return { count: 0 };

    return prisma.contentEntry.updateMany({
      where: {
        workspaceId,
        contentTypeId,
      },
      data: {
        seoTitle: null,
        metaDescription: null,
        keywords: [],
      },
    });
  }
}

export default new ContentEntryRepository();

/**
 * Listing entries dengan dukungan filter relasi M2M:
 * - Jika `fieldId` (RELATION M2M) dan `related` (entry target) diisi,
 *   maka hanya mengembalikan entry sumber yang terhubung ke target tsb.
 * - Jika tidak, fallback ke listing biasa dengan pagination.
 */
export async function findManyWithM2mRelated({
  workspaceId,
  contentTypeId,
  fieldId, // RELATION field (MANY_TO_MANY)
  related, // entryId target
  page = 1,
  pageSize = 20,
  where = {},
  orderBy = { createdAt: "desc" },
}) {
  const skip = (page - 1) * pageSize;

  if (fieldId && related) {
    const relRows = await prisma.contentRelationM2M.findMany({
      where: { relationFieldId: fieldId, toEntryId: related },
      select: { fromEntryId: true },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    });

    const ids = relRows.map((r) => r.fromEntryId);

    const [rows, total] = await prisma.$transaction([
      prisma.contentEntry.findMany({
        where: { id: { in: ids }, workspaceId, contentTypeId, ...where },
        orderBy,
      }),
      prisma.contentRelationM2M.count({
        where: { relationFieldId: fieldId, toEntryId: related },
      }),
    ]);

    return { rows, total, page, pageSize };
  }

  // Fallback: listing biasa
  const [rows, total] = await prisma.$transaction([
    prisma.contentEntry.findMany({
      where: { workspaceId, contentTypeId, ...where },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.contentEntry.count({
      where: { workspaceId, contentTypeId, ...where },
    }),
  ]);

  return { rows, total, page, pageSize };
}
