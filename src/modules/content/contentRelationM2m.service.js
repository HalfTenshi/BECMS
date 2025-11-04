import prisma from "../../config/prismaClient.js";
import m2mRepo from "./contentRelationM2m.repository.js";

function assert(cond, msg) { if (!cond) throw new Error(msg); }

class ContentRelationM2mService {
  async getRelationFieldOrThrow({ workspaceId, fieldId }) {
    const field = await prisma.contentField.findUnique({ where: { id: fieldId } });
    assert(field, "Relation field not found");
    assert(field.workspaceId === workspaceId, "Relation field not in workspace");
    assert(field.type === "RELATION", "Field is not RELATION type");

    const rel = await prisma.relationConfig.findUnique({ where: { fieldId } });
    assert(rel, "Missing relation config");
    assert(rel.kind === "MANY_TO_MANY", "Relation kind must be MANY_TO_MANY");
    return { field, rel };
  }

  async attach({ workspaceId, fieldId, fromEntryId, toEntryIds = [] }) {
    const { rel } = await this.getRelationFieldOrThrow({ workspaceId, fieldId });

    const from = await prisma.contentEntry.findUnique({
      where: { id: fromEntryId },
      select: { id: true, workspaceId: true, contentTypeId: true }
    });
    assert(from && from.workspaceId === workspaceId, "From entry not found in workspace");

    const targets = await prisma.contentEntry.findMany({
      where: { id: { in: toEntryIds }, workspaceId, contentTypeId: rel.targetContentTypeId },
      select: { id: true },
    });
    assert(targets.length === toEntryIds.length, "Some target entries not found / CT mismatch");

    return m2mRepo.attachMany({
      workspaceId,
      relationFieldId: fieldId,
      fromEntryId,
      toEntryIds
    });
  }

  async detach({ workspaceId, fieldId, fromEntryId, toEntryIds = [] }) {
    await this.getRelationFieldOrThrow({ workspaceId, fieldId });
    return m2mRepo.detachMany({
      relationFieldId: fieldId,
      fromEntryId,
      toEntryIds
    });
  }

  async list({ workspaceId, fieldId, fromEntryId, page = 1, pageSize = 20 }) {
    await this.getRelationFieldOrThrow({ workspaceId, fieldId });
    return m2mRepo.listRelated({
      relationFieldId: fieldId,
      fromEntryId,
      page, pageSize
    });
  }

  async filterFromByRelated({ workspaceId, fieldId, relatedEntryId, page = 1, pageSize = 20 }) {
    await this.getRelationFieldOrThrow({ workspaceId, fieldId });
    return m2mRepo.findFromByRelated({
      relationFieldId: fieldId,
      relatedEntryId,
      page, pageSize
    });
  }
}

export default new ContentRelationM2mService();
