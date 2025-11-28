// src/modules/seo/seoSupport.service.test.js
import { describe, it, expect } from "vitest";
import seoSupportService from "./seoSupport.service.js";
import {
  MAX_SEO_TITLE_LENGTH,
  MAX_META_DESCRIPTION_LENGTH,
} from "../../utils/seoUtils.js";

describe("SEO Support Service - analyze()", () => {
  it("should mark long title as too_long and add proper penalties/bonuses", async () => {
    const payload = {
      title:
        "Contoh judul super panjang yang mungkin terlalu panjang untuk SEO SERP Google",
      description: "Deskripsi singkat tentang konten ini.",
      slug: "contoh-judul-super-panjang",
      content: "",
      focusKeyword: "judul super panjang",
    };

    const result = await seoSupportService.analyze(payload);

    // Title
    expect(result.title.length).toBe(payload.title.length);
    expect(result.title.max).toBe(MAX_SEO_TITLE_LENGTH);
    expect(result.title.status).toBe("too_long");

    // Description
    expect(result.description.length).toBe(
      payload.description.length
    );
    expect(result.description.max).toBe(MAX_META_DESCRIPTION_LENGTH);
    expect(result.description.status).toBe("too_short");

    // Keyword checks
    expect(result.keyword.value).toBe(payload.focusKeyword);
    expect(result.keyword.inTitle).toBe(true);
    expect(result.keyword.inSlug).toBe(true);
    expect(result.keyword.inDescription).toBe(false);

    // Score & breakdown (boleh agak fleksibel, tapi minimal cek yang kritikal)
    expect(result.score.overall).toBeGreaterThan(0);
    expect(result.score.overall).toBeLessThan(100);

    expect(result.score.breakdown.penalties).toEqual(
      expect.arrayContaining([
        "TITLE_TOO_LONG",
        "DESCRIPTION_TOO_SHORT",
        "KEYWORD_NOT_IN_DESCRIPTION",
      ])
    );
    expect(result.score.breakdown.bonuses).toEqual(
      expect.arrayContaining(["KEYWORD_IN_TITLE", "KEYWORD_IN_SLUG"])
    );
  });

  it("should mark empty title & description as empty and heavily penalize score", async () => {
    const result = await seoSupportService.analyze({
      title: "",
      description: "",
      slug: "",
      content: "",
      focusKeyword: "",
    });

    expect(result.title.status).toBe("empty");
    expect(result.description.status).toBe("empty");

    // Skor harus jauh di bawah 100
    expect(result.score.overall).toBeLessThan(80);

    expect(result.score.breakdown.penalties).toEqual(
      expect.arrayContaining(["TITLE_EMPTY", "DESCRIPTION_EMPTY"])
    );
  });

  it("should return ok status for reasonable title and description", async () => {
    const result = await seoSupportService.analyze({
      title: "Judul yang pas untuk artikel SEO",
      description:
        "Ini adalah deskripsi meta yang cukup panjang tetapi masih dalam batas wajar untuk hasil pencarian.",
      slug: "judul-yang-pas-untuk-artikel-seo",
      content:
        "Ini adalah isi artikel yang punya beberapa kata dan kalimat agar tidak terlalu pendek.",
      focusKeyword: "artikel SEO",
    });

    expect(result.title.status).toBe("ok");
    expect(result.description.status).toBe("ok");

    // Skor harus cukup tinggi
    expect(result.score.overall).toBeGreaterThanOrEqual(70);
    expect(result.score.overall).toBeLessThanOrEqual(100);
  });
});
