import prisma from "../../config/prismaClient.js";

class ContentEntryRepository {
  async findAll({ where = {}, include = { contentType: true, values: true }, orderBy = { createdAt: "desc" }, skip, take } = {}) {
    return prisma.contentEntry.findMany({
      where,
      include,
      orderBy,
      skip,
      take,
    });
  }

  async findById(id, include = { contentType: true, values: true }) {
    return prisma.contentEntry.findUnique({
      where: { id },
      include,
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
        keywords: Array.isArray(data.keywords) ? data.keywords : [], // service sudah normalisasi, di sini berjaga2
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
        isPublished: typeof data.isPublished === "boolean" ? data.isPublished : undefined,
        publishedAt: data.publishedAt ?? undefined,
        updatedById: data.updatedById ?? undefined,
      },
    });
  }

  async delete(id) {
    return prisma.contentEntry.delete({ where: { id } });
  }

  async publish(id) {
    return prisma.contentEntry.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
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
  fieldId,            // RELATION field (MANY_TO_MANY)
  related,            // entryId target
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
