// src/modules/content/contentType.service.js
import prisma from "../../config/prismaClient.js";
import contentTypeRepository from "./contentType.repository.js";

const API_KEY_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

class ContentTypeService {
  async getAll(workspaceId) {
    return contentTypeRepository.findAllByWorkspace(workspaceId);
  }

  async getById(id, workspaceId) {
    const ct = await contentTypeRepository.findByIdInWorkspace(
      id,
      workspaceId
    );
    if (!ct) {
      throw new Error("Content type not found");
    }
    return ct;
  }

  async create(data, workspaceId) {
    const name = data.name?.trim();
    const apiKey = data.apiKey?.trim();

    if (!name || !apiKey) {
      throw new Error("name and apiKey are required");
    }

    if (!API_KEY_REGEX.test(apiKey)) {
      throw new Error(
        "apiKey must start with a letter and contain only letters, numbers, or underscore"
      );
    }

    // Pastikan apiKey unik di workspace ini
    const existing = await prisma.contentType.findFirst({
      where: { workspaceId, apiKey },
    });
    if (existing) {
      throw new Error("apiKey already exists in this workspace");
    }

    return contentTypeRepository.create({
      ...data,
      name,
      apiKey,
      workspaceId,
    });
  }

  async update(id, data, workspaceId) {
    // Pastikan content type milik workspace ini
    const ct = await contentTypeRepository.findByIdInWorkspace(
      id,
      workspaceId
    );
    if (!ct) {
      throw new Error("Content type not found");
    }

    const payload = { ...data };

    if (payload.name) {
      payload.name = String(payload.name).trim();
    }

    if (payload.apiKey) {
      payload.apiKey = String(payload.apiKey).trim();
      if (!API_KEY_REGEX.test(payload.apiKey)) {
        throw new Error(
          "apiKey must start with a letter and contain only letters, numbers, or underscore"
        );
      }

      // Cek unik apiKey kalau diubah
      if (payload.apiKey !== ct.apiKey) {
        const existing = await prisma.contentType.findFirst({
          where: {
            workspaceId,
            apiKey: payload.apiKey,
            NOT: { id },
          },
        });
        if (existing) {
          throw new Error("apiKey already exists in this workspace");
        }
      }
    }

    return contentTypeRepository.update(id, payload);
  }

  async delete(id, workspaceId) {
    // Pastikan content type milik workspace ini
    const ct = await contentTypeRepository.findByIdInWorkspace(
      id,
      workspaceId
    );
    if (!ct) {
      throw new Error("Content type not found");
    }

    // Guard: jangan hapus kalau masih ada entries
    const entryCount = await prisma.contentEntry.count({
      where: { contentTypeId: id, workspaceId },
    });

    if (entryCount > 0) {
      throw new Error(
        "Cannot delete content type that still has content entries"
      );
    }

    await contentTypeRepository.delete(id);
    return { message: "Content type deleted" };
  }
}

export default new ContentTypeService();
