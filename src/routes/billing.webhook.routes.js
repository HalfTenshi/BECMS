// src/routes/public/billing.webhook.routes.js
// @ts-nocheck

import express from "express";
import crypto from "crypto";
import subscriptionController from "../modules/subscription/subscription.controller.js";

const router = express.Router();

/**
 * Compare string secara aman (anti timing attack).
 */
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Verifikasi X-CALLBACK-TOKEN dari Xendit.
 */
function verifyCallbackToken(req) {
  const expected = process.env.XENDIT_CALLBACK_TOKEN;
  if (!expected) {
    // kalau env belum di-set, lebih aman dianggap gagal
    return false;
  }

  const headerToken = req.headers["x-callback-token"];
  if (!headerToken) return false;

  return safeEqual(String(headerToken), String(expected));
}

/**
 * Verifikasi HMAC signature (X-Callback-Signature, HMAC-SHA256(rawBody, secret)).
 */
function verifyCallbackSignature(req, rawBody) {
  const secret = process.env.XENDIT_WEBHOOK_SECRET;
  if (!secret) return false;

  const signatureHeader = req.headers["x-callback-signature"];
  if (!signatureHeader) return false;

  const expectedSig = crypto
    .createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(rawBody)
    .digest("hex");

  return safeEqual(String(signatureHeader), String(expectedSig));
}

/**
 * Verifikasi timestamp (opsional, anti replay).
 */
function verifyCallbackTimestamp(req) {
  const tsHeader = req.headers["x-callback-timestamp"];
  if (!tsHeader) return false;

  const maxSkew = Number(process.env.XENDIT_WEBHOOK_MAX_SKEW_SECONDS || "300"); // 5 menit
  const nowSec = Math.floor(Date.now() / 1000);
  const ts = Number(tsHeader);
  if (!Number.isFinite(ts)) return false;

  const diff = Math.abs(nowSec - ts);
  return diff <= maxSkew;
}

// POST /api/webhooks/billing
// NOTE: route ini jangan kena express.json() global sebelum ini.
router.post("/", express.raw({ type: "*/*" }), async (req, res) => {
  try {
    const rawBody = req.body; // Buffer

    // 1) Token statis dari Dashboard Xendit
    if (!verifyCallbackToken(req)) {
      return res.status(401).json({
        success: false,
        message: "Invalid X-CALLBACK-TOKEN",
      });
    }

    // 2) HMAC signature
    if (!verifyCallbackSignature(req, rawBody)) {
      return res.status(401).json({
        success: false,
        message: "Invalid X-Callback-Signature",
      });
    }

    // 3) Timestamp (opsional tapi disarankan)
    if (!verifyCallbackTimestamp(req)) {
      return res.status(408).json({
        success: false,
        message: "Callback timestamp is too far from server time",
      });
    }

    // ✅ Semua lolos → parse JSON
    let payload = {};
    if (rawBody && rawBody.length > 0) {
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Invalid JSON payload",
        });
      }
    }

    // inject payload ke req.body supaya controller tetap kerja normal
    req.body = payload;

    // teruskan ke controller (akan panggil subscriptionService.handleBillingWebhookEvent)
    return subscriptionController.billingWebhook(req, res);
  } catch (err) {
    console.error("Xendit webhook error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default router;
