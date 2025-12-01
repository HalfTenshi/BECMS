// src/modules/plan/plan.service.js
import planRepository from "./plan.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

class PlanService {
  async getAll() {
    // Ambil semua plan
    return await planRepository.findAll();
  }

  async getById(id) {
    if (!id) {
      throw ApiError.badRequest("Plan id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PLAN_ID_REQUIRED",
        resource: "PLANS",
      });
    }

    const plan = await planRepository.findById(id);
    if (!plan) {
      throw ApiError.notFound("Plan not found", {
        code: ERROR_CODES.PLAN_NOT_FOUND,
        reason: "PLAN_NOT_FOUND",
        resource: "PLANS",
        details: { id },
      });
    }
    return plan;
  }

  async create(data) {
    if (!data?.name) {
      throw ApiError.badRequest("Plan name is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PLAN_NAME_REQUIRED",
        resource: "PLANS",
      });
    }

    // Default harga jika tidak diisi
    const monthlyPrice =
      data.monthlyPrice == null ? 0 : Number(data.monthlyPrice);
    const yearlyPrice =
      data.yearlyPrice == null ? 0 : Number(data.yearlyPrice);

    if (Number.isNaN(monthlyPrice) || monthlyPrice < 0) {
      throw ApiError.badRequest("monthlyPrice must be a non-negative number", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PLAN_INVALID_MONTHLY_PRICE",
        resource: "PLANS",
      });
    }

    if (Number.isNaN(yearlyPrice) || yearlyPrice < 0) {
      throw ApiError.badRequest("yearlyPrice must be a non-negative number", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PLAN_INVALID_YEARLY_PRICE",
        resource: "PLANS",
      });
    }

    return await planRepository.create({
      name: data.name,
      monthlyPrice,
      yearlyPrice,
      maxMembers: data.maxMembers,
      maxContentTypes: data.maxContentTypes,
      maxEntries: data.maxEntries,
    });
  }

  async update(id, data) {
    if (!id) {
      throw ApiError.badRequest("Plan id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PLAN_ID_REQUIRED",
        resource: "PLANS",
      });
    }

    const existing = await planRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("Plan not found", {
        code: ERROR_CODES.PLAN_NOT_FOUND,
        reason: "PLAN_NOT_FOUND",
        resource: "PLANS",
        details: { id },
      });
    }

    const payload = {
      name: data.name ?? existing.name,
      monthlyPrice: data.monthlyPrice ?? existing.monthlyPrice,
      yearlyPrice: data.yearlyPrice ?? existing.yearlyPrice,
      maxMembers: data.maxMembers ?? existing.maxMembers,
      maxContentTypes: data.maxContentTypes ?? existing.maxContentTypes,
      maxEntries: data.maxEntries ?? existing.maxEntries,
    };

    return await planRepository.update(id, payload);
  }

  async delete(id) {
    if (!id) {
      throw ApiError.badRequest("Plan id is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "PLAN_ID_REQUIRED",
        resource: "PLANS",
      });
    }

    const existing = await planRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound("Plan not found", {
        code: ERROR_CODES.PLAN_NOT_FOUND,
        reason: "PLAN_NOT_FOUND",
        resource: "PLANS",
        details: { id },
      });
    }

    return await planRepository.delete(id);
  }
}

export default new PlanService();
