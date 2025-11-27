// src/modules/billing/xendit.service.js
// @ts-nocheck

import axios from "axios";
import crypto from "crypto";

const XENDIT_BASE_URL = process.env.XENDIT_BASE_URL || "https://api.xendit.co";
const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY || "";
const DEFAULT_TIMEOUT_MS = Number(process.env.XENDIT_TIMEOUT_MS || "15000");
const DEFAULT_MAX_RETRIES = Number(process.env.XENDIT_MAX_RETRIES || "3");

// Helper: bikin instance axios untuk Xendit
function createXenditClient() {
  if (!XENDIT_SECRET_KEY) {
    throw new Error("XENDIT_SECRET_KEY is not set in environment");
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
      // biarkan 4xx/5xx tetap dikembalikan sebagai response (bukan throw)
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

  throw lastError;
}

/**
 * Verifikasi signature webhook Xendit.
 * Dipakai kalau kamu mau pakai ini di route lain.
 *
 * - rawBody: Buffer dari express.raw()
 * - headers: req.headers
 * - secret: biasanya pakai ENV XENDIT_WEBHOOK_SECRET
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
   *
   * Params:
   * - workspaceId: id workspace BECMS
   * - planId     : id plan BECMS
   * - amount     : jumlah tagihan (number)
   * - currency   : default "IDR"
   * - description: default "Subscription BECMS"
   * - externalId : optional, kalau kosong kita generate otomatis
   * - successRedirectUrl / failureRedirectUrl: optional redirect URL
   * - customer   : optional { email, given_names, surname, ... }
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
      throw new Error("workspaceId and planId are required");
    }
    if (!amount || Number(amount) <= 0) {
      throw new Error("amount must be > 0");
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
      const err = new Error(
        `Failed to create Xendit invoice (status ${res.status})`
      );
      err.response = res.data;
      err.status = res.status;
      throw err;
    }

    return res.data;
  }

  /**
   * Ambil detail invoice dari Xendit.
   *
   * - invoiceId: id invoice Xendit (bukan external_id)
   */
  async getInvoiceById(invoiceId) {
    if (!invoiceId) throw new Error("invoiceId is required");

    const client = createXenditClient();

    const res = await withRetry(() =>
      client.get(`/v2/invoices/${encodeURIComponent(invoiceId)}`)
    );

    if (res.status < 200 || res.status >= 300) {
      const err = new Error(
        `Failed to get Xendit invoice (status ${res.status})`
      );
      err.response = res.data;
      err.status = res.status;
      throw err;
    }

    return res.data;
  }

  /**
   * Ambil invoice berdasarkan external_id (kalau kamu simpan external_id di DB).
   */
  async getInvoiceByExternalId(externalId) {
    if (!externalId) throw new Error("externalId is required");

    const client = createXenditClient();

    const res = await withRetry(() =>
      client.get("/v2/invoices", {
        params: {
          external_id: externalId,
        },
      })
    );

    if (res.status < 200 || res.status >= 300) {
      const err = new Error(
        `Failed to get Xendit invoice by external_id (status ${res.status})`
      );
      err.response = res.data;
      err.status = res.status;
      throw err;
    }

    // Dokumen Xendit biasanya balikin array untuk external_id
    const list = Array.isArray(res.data) ? res.data : res.data.data || [];
    return list;
  }

  /**
   * Expire invoice yang masih PENDING.
   * Xendit endpoint: POST /v2/invoices/{id}/expire
   */
  async expireInvoice(invoiceId) {
    if (!invoiceId) throw new Error("invoiceId is required");

    const client = createXenditClient();

    const res = await withRetry(() =>
      client.post(`/v2/invoices/${encodeURIComponent(invoiceId)}/expire`)
    );

    if (res.status < 200 || res.status >= 300) {
      const err = new Error(
        `Failed to expire Xendit invoice (status ${res.status})`
      );
      err.response = res.data;
      err.status = res.status;
      throw err;
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
