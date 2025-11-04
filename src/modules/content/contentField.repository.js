import prisma from "../../config/prismaClient.js";

class ContentFieldRepository {
  findCTById(id) {
    return prisma.contentType.findUnique({ where: { id } });
  }

  listByCT(contentTypeId) {
    return prisma.contentField.findMany({
      where: { contentTypeId },
      orderBy: { position: "asc" },
      include: { relation: true },
    });
  }

  findById(fieldId) {
    return prisma.contentField.findUnique({
      where: { id: fieldId },
      include: { relation: true, contentType: true },
    });
  }

  findByApiKey(contentTypeId, apiKey) {
    return prisma.contentField.findFirst({ where: { contentTypeId, apiKey } });
  }

  createField(data) {
    return prisma.contentField.create({ data });
  }

  updateField(fieldId, data) {
    return prisma.contentField.update({ where: { id: fieldId }, data });
  }

  deleteField(fieldId) {
    return prisma.contentField.delete({ where: { id: fieldId } });
  }

  upsertRelationConfig(fieldId, rel) {
    // rel: { kind, targetContentTypeId }
    return prisma.relationConfig.upsert({
      where: { fieldId },
      update: { kind: rel.kind, targetContentTypeId: rel.targetContentTypeId },
      create: { fieldId, kind: rel.kind, targetContentTypeId: rel.targetContentTypeId },
    });
  }

  deleteRelationConfig(fieldId) {
    return prisma.relationConfig.delete({ where: { fieldId } });
  }

  bulkUpdatePositions(updates) {
    // updates: [{ id, position }]
    return prisma.$transaction(
      updates.map(u => prisma.contentField.update({ where: { id: u.id }, data: { position: u.position } }))
    );
  }

  // For unique value check (validation)
  findExistingValue({ fieldId, entryIdToExclude, valueKey, value }) {
    const where = {
      fieldId,
      ...(entryIdToExclude ? { entryId: { not: entryIdToExclude } } : {}),
      [valueKey]: value,
    };
    return prisma.fieldValue.findFirst({ where });
  }
}

export default new ContentFieldRepository();
