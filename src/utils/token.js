import crypto from "crypto";

export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex"); // token plain utk dikirim via email
}

export function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex"); // disimpan di DB
}
