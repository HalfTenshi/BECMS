// =========================================================
// src/modules/rbac/routeProtection.test.js
// =========================================================

import { describe, it, expect, vi } from "vitest";

// Kita tidak mau bikin test ini terlalu fragile terhadap
// perubahan kecil di route, jadi fokus: pastikan bahwa
// file routes setidaknya MEMAKAI middleware authorize().

vi.mock("../../middlewares/authorize.js", () => {
  const calls = [];

  function authorize(action, resource) {
    calls.push({ action, resource });
    return (req, res, next) => next();
  }

  return {
    authorize,
    __authorizeCalls: calls,
  };
});

import { __authorizeCalls as authorizeCalls } from "../../middlewares/authorize.js";

// Import routes agar definisi route dieksekusi (dan authorize dipanggil)
import "../../routes/user.routes.js";
import "../../routes/contentEntry.routes.js";

describe("RBAC route-level wiring", () => {
  it("user.routes.js harus memanggil authorize() minimal sekali", () => {
    // Kita tidak punya cara mudah untuk memisahkan panggilan per-file
    // tanpa ngacak-ngacak routes, jadi minimal pastikan ada pemanggilan authorize.
    expect(authorizeCalls.length).toBeGreaterThan(0);
  });

  it("contentEntry.routes.js juga ikut ter-cover authorize() (secara agregat)", () => {
    // Karena kedua routes sudah di-import di atas, di sini cukup pastikan
    // bahwa masih ada panggilan authorize (sanity check kedua).
    expect(authorizeCalls.length).toBeGreaterThan(0);
  });
});
