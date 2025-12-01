// src/modules/content/fieldValue/fieldValue.service.js

import fieldValueRepository from "./fieldValue.repository.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ERROR_CODES } from "../../../constants/errorCodes.js";

class FieldValueService {
  async getByEntry(entryId) {
    if (!entryId) {
      throw ApiError.badRequest("entryId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "FIELD_VALUE_ENTRY_ID_REQUIRED",
        resource: "CONTENT_ENTRIES",
      });
    }
    return await fieldValueRepository.findByEntry(entryId);
  }

  async create(data) {
    if (!data?.entryId || !data?.fieldId) {
      throw ApiError.badRequest("entryId and fieldId are required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "FIELD_VALUE_REQUIRED_FIELDS_MISSING",
        resource: "CONTENT_ENTRIES",
        details: {
          entryId: !!data?.entryId,
          fieldId: !!data?.fieldId,
        },
      });
    }
    return await fieldValueRepository.create(data);
  }

  async update(id, data) {
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "FIELD_VALUE_ID_REQUIRED",
        resource: "CONTENT_ENTRIES",
      });
    }
    return await fieldValueRepository.update(id, data);
  }

  async delete(id) {
    if (!id) {
      throw ApiError.badRequest("id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "FIELD_VALUE_ID_REQUIRED",
        resource: "CONTENT_ENTRIES",
      });
    }
    return await fieldValueRepository.delete(id);
  }
}

export default new FieldValueService();
