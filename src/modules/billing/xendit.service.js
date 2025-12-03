// src/modules/billing/xendit.service.js
// @ts-nocheck

import axios from "axios";
import crypto from "crypto";
import { ApiError } from "../../utils/ApiError.js";
import { ERROR_CODES } from "../../constants/errorCodes.js";

const XENDIT_BASE_URL = process.env.XENDIT_BASE_URL || "https://api.xendit.co";
const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY || "";
const DEFAULT_TIMEOUT_MS = Number(process.env.XENDIT_TIMEOUT_MS || "15000");
const DEFAULT_MAX_RETRIES = Number(process.env.XENDIT_MAX_RETRIES || "3");

// Helper: bikin instance axios untuk Xendit
function createXenditClient() {
  if (!XENDIT_SECRET_KEY) {
    throw ApiError.internal("XENDIT_SECRET_KEY is not set in environment", {
      code: ERROR_CODES.BILLING_CONFIG_ERROR,
      reason: "BILLING_CONFIG_INVALID",
    });
  }

  return axios.create({
    baseURL: XENDIT_BASE_URL,
    timeout: DEFAULT_TIMEOUT_MS,
    auth: {
      username: XENDIT_SECRET_KEY,
      password: "",
    },
    headers: {
      "Content-Type": "application/json",
    },
    maxRedirects: 0,
    validateStatus(status) {
      // biarkan 4xx/5xx tetap dikembalikan sebagai response (bukan throw axios)
      return status >= 200 && status < 500;
    },
  });
}

// Helper: retry sederhana untuk network / 5xx
async function withRetry(fn, { maxRetries = DEFAULT_MAX_RETRIES } = {}) {
  let attempt = 0;
  let lastError;

  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isNetworkError = !err.response && !!err.request;
      const status = err.response?.status;

      // retry hanya untuk network error atau 5xx
      if (!isNetworkError && !(status >= 500 && status <= 599)) {
        throw err;
      }

      attempt += 1;
      if (attempt > maxRetries) {
        break;
      }

      // backoff sederhana
      const delayMs = 200 * attempt;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // Bungkus lastError sebagai ApiError 500 (gateway/network)
  throw ApiError.internal("Failed to call Xendit API after retries", {
    code: ERROR_CODES.BILLING_NETWORK_ERROR,
    reason: "BILLING_API_ERROR",
    details: { message: lastError?.message },
  });
}

/**
 * Verifikasi signature webhook Xendit.
 *
 * NOTE: Kalau signature invalid, fungsi ini hanya return false.
 * Kalau kamu ingin lempar error dari route, gunakan ApiError di route handler.
 */
export function validateWebhookSignature(rawBody, headers, secret) {
  const usedSecret = secret || process.env.XENDIT_WEBHOOK_SECRET;
  if (!usedSecret) return false;

  const signatureHeader = headers["x-callback-signature"];
  if (!signatureHeader) return false;

  const expectedSig = crypto
    .createHmac("sha256", Buffer.from(usedSecret, "utf8"))
    .update(rawBody)
    .digest("hex");

  const aBuf = Buffer.from(String(signatureHeader), "utf8");
  const bBuf = Buffer.from(String(expectedSig), "utf8");

  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

class XenditBillingService {
  /**
   * Buat invoice Xendit untuk subscription.
   */
  async createInvoice({
    workspaceId,
    planId,
    amount,
    currency = "IDR",
    description = "Subscription BECMS",
    externalId,
    successRedirectUrl,
    failureRedirectUrl,
    customer,
  }) {
    if (!workspaceId || !planId) {
      throw ApiError.badRequest("workspaceId and planId are required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BILLING_CREATE_INVOICE_MISSING_FIELDS",
      });
    }
    if (!amount || Number(amount) <= 0) {
      throw ApiError.badRequest("amount must be > 0", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BILLING_AMOUNT_INVALID",
      });
    }

    const client = createXenditClient();
    const finalExternalId =
      externalId || `becms-sub-${workspaceId}-${planId}-${Date.now()}`;

    const payload = {
      external_id: finalExternalId,
      amount: Number(amount),
      currency,
      description,
      metadata: {
        workspaceId,
        planId,
      },
    };

    if (successRedirectUrl) {
      payload.success_redirect_url = successRedirectUrl;
    }
    if (failureRedirectUrl) {
      payload.failure_redirect_url = failureRedirectUrl;
    }
    if (customer && typeof customer === "object") {
      payload.customer = customer;
    }

    const res = await withRetry(() => client.post("/v2/invoices", payload));

    if (res.status < 200 || res.status >= 300) {
      throw new ApiError(res.status, "Failed to create Xendit invoice", {
        code: ERROR_CODES.BILLING_GATEWAY_ERROR,
        reason: "BILLING_API_ERROR",
        details: res.data,
      });
    }

    return res.data;
  }

  /**
   * Ambil detail invoice dari Xendit (by invoiceId).
   */
  async getInvoiceById(invoiceId) {
    if (!invoiceId) {
      throw ApiError.badRequest("invoiceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BILLING_INVOICE_ID_REQUIRED",
      });
    }

    const client = createXenditClient();

    const res = await withRetry(() =>
      client.get(`/v2/invoices/${encodeURIComponent(invoiceId)}`)
    );

    if (res.status === 404) {
      throw ApiError.notFound("Xendit invoice not found", {
        code: ERROR_CODES.BILLING_INVOICE_NOT_FOUND,
        reason: "BILLING_INVOICE_NOT_FOUND",
        details: { invoiceId },
      });
    }

    if (res.status < 200 || res.status >= 300) {
      throw new ApiError(res.status, "Failed to get Xendit invoice", {
        code: ERROR_CODES.BILLING_GATEWAY_ERROR,
        reason: "BILLING_API_ERROR",
        details: res.data,
      });
    }

    return res.data;
  }

  /**
   * Ambil invoice berdasarkan external_id.
   */
  async getInvoiceByExternalId(externalId) {
    if (!externalId) {
      throw ApiError.badRequest("externalId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BILLING_EXTERNAL_ID_REQUIRED",
      });
    }

    const client = createXenditClient();

    const res = await withRetry(() =>
      client.get("/v2/invoices", {
        params: {
          external_id: externalId,
        },
      })
    );

    if (res.status < 200 || res.status >= 300) {
      throw new ApiError(
        res.status,
        "Failed to get Xendit invoice by external_id",
        {
          code: ERROR_CODES.BILLING_GATEWAY_ERROR,
          reason: "BILLING_API_ERROR",
          details: res.data,
        }
      );
    }

    // Dokumen Xendit biasanya balikin array untuk external_id
    const list = Array.isArray(res.data) ? res.data : res.data.data || [];
    return list;
  }

  /**
   * Expire invoice yang masih PENDING.
   */
  async expireInvoice(invoiceId) {
    if (!invoiceId) {
      throw ApiError.badRequest("invoiceId is required", {
        code: ERROR_CODES.VALIDATION_ERROR,
        reason: "BILLING_INVOICE_ID_REQUIRED",
      });
    }

    const client = createXenditClient();

    const res = await withRetry(() =>
      client.post(`/v2/invoices/${encodeURIComponent(invoiceId)}/expire`)
    );

    if (res.status < 200 || res.status >= 300) {
      throw new ApiError(res.status, "Failed to expire Xendit invoice", {
        code: ERROR_CODES.BILLING_GATEWAY_ERROR,
        reason: "BILLING_API_ERROR",
        details: res.data,
      });
    }

    return res.data;
  }
}

// Instance tunggal
const xenditBillingService = new XenditBillingService();

export default xenditBillingService;

// Optional: export helper function biar mirip snippet awal kamu
export const createInvoice = (params) =>
  xenditBillingService.createInvoice(params);
export const getInvoiceById = (invoiceId) =>
  xenditBillingService.getInvoiceById(invoiceId);
export const getInvoiceByExternalId = (externalId) =>
  xenditBillingService.getInvoiceByExternalId(externalId);
export const expireInvoice = (invoiceId) =>
  xenditBillingService.expireInvoice(invoiceId);
