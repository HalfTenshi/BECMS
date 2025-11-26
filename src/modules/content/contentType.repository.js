// src/modules/content/contentType.repository.js
import prisma from "../../config/prismaClient.js";

class ContentTypeRepository {
  async findAllByWorkspace(workspaceId) {
    return prisma.contentType.findMany({
      where: { workspaceId },
      include: { fields: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByIdInWorkspace(id, workspaceId) {
    return prisma.contentType.findFirst({
      where: { id, workspaceId },
      include: { fields: true },
    });
  }

  async create(data) {
    const { name, apiKey, workspaceId, description, visibility, seoEnabled } =
      data;

    return prisma.contentType.create({
      data: {
        name,
        apiKey,
        workspaceId,
        description: description ?? null,
        visibility: visibility ?? "PUBLIC", // atau sesuaikan default di schema
        seoEnabled: seoEnabled ?? true,
      },
    });
  }

  async update(id, data) {
    const updatable = {
      name: data.name,
      apiKey: data.apiKey,
      description: data.description,
      visibility: data.visibility,
      seoEnabled: data.seoEnabled,
    };

    // buang field undefined supaya tidak overwrite
    const cleaned = Object.fromEntries(
      Object.entries(updatable).filter(([, v]) => v !== undefined)
    );

    return prisma.contentType.update({
      where: { id },
      data: cleaned,
    });
  }

  async delete(id) {
    return prisma.contentType.delete({ where: { id } });
  }
}

export default new ContentTypeRepository();
