// src/modules/seo/seoSupport.service.js

import {
  MAX_SEO_TITLE_LENGTH,
  MAX_META_DESCRIPTION_LENGTH,
} from "../../utils/seoUtils.js";

function normalizeString(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeKeyword(value) {
  const s = normalizeString(value);
  return s.length > 0 ? s : null;
}

function containsIgnoreCase(haystack, needle) {
  if (!haystack || !needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

class SeoSupportService {
  /**
   * Analisa sederhana SEO untuk title/description/slug/konten.
   *
   * @param {Object} params
   * @param {string} [params.title]
   * @param {string} [params.description]
   * @param {string} [params.slug]
   * @param {string} [params.content]
   * @param {string} [params.focusKeyword]
   */
  async analyze({ title, description, slug, content, focusKeyword } = {}) {
    const titleText = normalizeString(title);
    const descText = normalizeString(description);
    const slugText = normalizeString(slug);
    const contentText = normalizeString(content);
    const keyword = normalizeKeyword(focusKeyword);

    const titleLength = titleText.length;
    const descLength = descText.length;

    // ---- Title status -------------------------------------------------------
    let titleStatus = "empty";
    if (titleLength === 0) {
      titleStatus = "empty";
    } else if (titleLength > MAX_SEO_TITLE_LENGTH) {
      titleStatus = "too_long";
    } else if (titleLength < 30) {
      // threshold "too short" opsional, kamu bisa adjust
      titleStatus = "too_short";
    } else {
      titleStatus = "ok";
    }

    // ---- Description status -------------------------------------------------
    let descStatus = "empty";
    if (descLength === 0) {
      descStatus = "empty";
    } else if (descLength > MAX_META_DESCRIPTION_LENGTH) {
      descStatus = "too_long";
    } else if (descLength < 70) {
      // optional threshold "terlalu pendek"
      descStatus = "too_short";
    } else {
      descStatus = "ok";
    }

    // ---- Keyword checks -----------------------------------------------------
    const keywordInTitle = keyword
      ? containsIgnoreCase(titleText, keyword)
      : false;
    const keywordInDescription = keyword
      ? containsIgnoreCase(descText, keyword)
      : false;
    const keywordInSlug = keyword
      ? containsIgnoreCase(slugText, keyword.replace(/\s+/g, "-"))
      : false;

    // Keyword density kasar di content (optional)
    let keywordDensity = null;
    if (keyword && contentText.length > 0) {
      const words = contentText
        .split(/\s+/)
        .map((w) => w.trim())
        .filter(Boolean);
      const totalWords = words.length;
      const keywordCount = words.filter((w) =>
        containsIgnoreCase(w, keyword)
      ).length;
      keywordDensity =
        totalWords > 0 ? +(100 * (keywordCount / totalWords)).toFixed(2) : 0;
    }

    // ---- Simple scoring (0-100) --------------------------------------------
    let score = 100;
    const breakdown = {
      base: 100,
      penalties: [],
      bonuses: [],
    };

    if (titleStatus === "empty") {
      score -= 30;
      breakdown.penalties.push("TITLE_EMPTY");
    } else if (titleStatus === "too_long") {
      score -= 20;
      breakdown.penalties.push("TITLE_TOO_LONG");
    } else if (titleStatus === "too_short") {
      score -= 10;
      breakdown.penalties.push("TITLE_TOO_SHORT");
    }

    if (descStatus === "empty") {
      score -= 20;
      breakdown.penalties.push("DESCRIPTION_EMPTY");
    } else if (descStatus === "too_long") {
      score -= 10;
      breakdown.penalties.push("DESCRIPTION_TOO_LONG");
    } else if (descStatus === "too_short") {
      score -= 5;
      breakdown.penalties.push("DESCRIPTION_TOO_SHORT");
    }

    if (keyword) {
      if (!keywordInTitle) {
        score -= 10;
        breakdown.penalties.push("KEYWORD_NOT_IN_TITLE");
      } else {
        breakdown.bonuses.push("KEYWORD_IN_TITLE");
      }

      if (!keywordInDescription) {
        score -= 5;
        breakdown.penalties.push("KEYWORD_NOT_IN_DESCRIPTION");
      } else {
        breakdown.bonuses.push("KEYWORD_IN_DESCRIPTION");
      }

      if (!keywordInSlug) {
        score -= 5;
        breakdown.penalties.push("KEYWORD_NOT_IN_SLUG");
      } else {
        breakdown.bonuses.push("KEYWORD_IN_SLUG");
      }
    }

    if (keywordDensity !== null) {
      if (keywordDensity < 0.5) {
        breakdown.penalties.push("KEYWORD_DENSITY_TOO_LOW");
      } else if (keywordDensity > 5) {
        breakdown.penalties.push("KEYWORD_DENSITY_TOO_HIGH");
      } else {
        breakdown.bonuses.push("KEYWORD_DENSITY_OK");
      }
    }

    // clamp score
    if (score < 0) score = 0;
    if (score > 100) score = 100;

    return {
      title: {
        value: titleText || null,
        length: titleLength,
        max: MAX_SEO_TITLE_LENGTH,
        status: titleStatus, // "ok" | "too_long" | "too_short" | "empty"
      },
      description: {
        value: descText || null,
        length: descLength,
        max: MAX_META_DESCRIPTION_LENGTH,
        status: descStatus, // "ok" | "too_long" | "too_short" | "empty"
      },
      keyword: {
        value: keyword,
        inTitle: keywordInTitle,
        inDescription: keywordInDescription,
        inSlug: keywordInSlug,
        densityPercent: keywordDensity,
      },
      score: {
        overall: score,
        breakdown,
      },
    };
  }
}

export default new SeoSupportService();
