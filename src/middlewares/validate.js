// src/middlewares/validate.js
import { validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";
import { ERROR_CODES } from "../constants/errorCodes.js";

export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new ApiError(400, "Validation failed", {
        code: ERROR_CODES.VALIDATION_ERROR,
        details: errors.array(),
      })
    );
  }
  next();
}
