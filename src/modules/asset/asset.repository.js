// src/modules/asset/asset.repository.js
import prisma from "../../config/prismaClient.js";

class AssetRepository {
  /**
   * Bulk create asset (dipakai kalau suatu saat butuh batch ingest).
   * skipDuplicates=true menghormati unique constraint (checksum).
   */
  createMany(dataList) {
    return prisma.asset.createMany({ data: dataList, skipDuplicates: true });
  }

  async createOne(data) {
    return prisma.asset.create({ data });
  }

  /**
   * Listing asset per workspace dengan filter:
   * - q          : search originalName / filename (contains, insensitive)
   * - mime       : prefix match, misal "image/" atau "image/png"
   * - onlyImages : boolean → kalau true paksa mime startsWith("image/")
   * - tag        : filter array tags (Postgres text[])
   * - folder     : exact match folder (string)
   * - page       : pagination (1-based)
   * - limit      : items per page
   * - sort       : "createdAt:desc", "createdAt:asc", dll
   */
  async list({
    workspaceId,
    q,
    mime,
    onlyImages = false,
    tag,
    folder,
    page = 1,
    limit = 20,
    sort = "createdAt:desc",
  }) {
    const [sortFieldRaw, sortDirRaw] = String(sort).split(":");
    const sortField = sortFieldRaw || "createdAt";
    const sortDir =
      (sortDirRaw || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (pageNum - 1) * pageSize;

    // MIME condition:
    // - kalau onlyImages=true → paksa "image/"
    // - kalau onlyImages=false dan mime ada → pakai prefix mime
    // - kalau dua-duanya ada dan onlyImages=true → onlyImages menang (lebih aman/tepat)
    let mimeCondition = null;
    if (onlyImages) {
      mimeCondition = { startsWith: "image/" };
    } else if (mime) {
      mimeCondition = { startsWith: mime };
    }

    const where = {
      workspaceId,
      ...(q
        ? {
            OR: [
              {
                originalName: {
                  contains: q,
                  mode: "insensitive",
                },
              },
              {
                filename: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
      ...(mimeCondition
        ? {
            mime: mimeCondition,
          }
        : {}),
      ...(tag
        ? {
            tags: {
              has: tag,
            },
          }
        : {}),
      ...(folder
        ? {
            folder,
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        skip,
        take: pageSize,
      }),
      prisma.asset.count({ where }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Ambil asset by id, optional filter workspaceId
   * (multi-tenant aware).
   */
  async getById(id, workspaceId) {
    return prisma.asset.findFirst({
      where: {
        id,
        ...(workspaceId ? { workspaceId } : {}),
      },
    });
  }

  async delete(id) {
    return prisma.asset.delete({ where: { id } });
    // NOTE: workspaceId dicek di service sebelum panggil delete
  }

  async update(id, data) {
    return prisma.asset.update({ where: { id }, data });
  }

  /**
   * Optional helper untuk dedupe berdasarkan checksum.
   */
  async findByChecksum(checksum) {
    if (!checksum) return null;
    return prisma.asset.findFirst({
      where: { checksum },
    });
  }
}

export default new AssetRepository();
