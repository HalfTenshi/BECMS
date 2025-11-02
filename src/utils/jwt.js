import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev_secret";
const EXPIRES_IN = process.env.JWT_EXPIRES || "7d";

export function signAccessToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

// token khusus reset password (expired cepat, mis. 15 menit)
export function signResetToken(payload) {
  return jwt.sign({ ...payload, kind: "reset" }, SECRET, { expiresIn: "15m" });
}
