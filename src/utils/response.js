// src/utils/response.js

export function ok(res, data, meta) {
  return res.status(200).json({
    success: true,
    data,
    meta: meta || undefined,
  });
}

export function created(res, data, meta) {
  return res.status(201).json({
    success: true,
    data,
    meta: meta || undefined,
  });
}

export function noContent(res) {
  return res.status(204).send(); // tidak ada body
}
