// @vitest-environment node
import { describe, it, expect } from "vitest"
import { pickCertification } from "@/lib/age-rating"
import { buildGenreTextSvg, genreBadgeSvgDims } from "@/lib/badge-svg-shared"
import { resolvePosterRenderConfig } from "@/lib/poster-config"

const movie = {
  results: [
    { iso_3166_1: "DE", release_dates: [{ certification: "12", type: 3 }] },
    { iso_3166_1: "US", release_dates: [{ certification: "", type: 1 }, { certification: "R", type: 4 }, { certification: "PG-13", type: 3 }] },
  ],
}
const tv = { results: [{ iso_3166_1: "US", rating: "TV-MA" }, { iso_3166_1: "GB", rating: "18" }] }

describe("pickCertification", () => {
  it("prefers the theatrical US certification for movies", () => {
    expect(pickCertification("movie", movie, ["US"])).toBe("PG-13")
  })
  it("uses the TV content rating", () => {
    expect(pickCertification("tv", tv, ["US"])).toBe("TV-MA")
    expect(pickCertification("tv", tv, ["GB", "US"])).toBe("18")
  })
  it("falls back to the next country, then null", () => {
    expect(pickCertification("movie", movie, ["FR", "DE"])).toBe("12")
    expect(pickCertification("movie", movie, ["FR"])).toBeNull()
    expect(pickCertification("movie", null, ["US"])).toBeNull()
  })
})

describe("genre bar with age rating", () => {
  it("adds a boxed tag after the year and widens the bar", () => {
    const plain = genreBadgeSvgDims(16, "", "6.8", "2024")
    const withAge = genreBadgeSvgDims(16, "", "6.8", "2024", { ageRating: "PG-13" })
    expect(withAge.textContentW).toBeGreaterThan(plain.textContentW)
    const svg = buildGenreTextSvg("", "6.8", "2024", 16, "#fff", "shadow", 0, { ageRating: "PG-13" }, "AAAA").svg
    expect(svg).toContain("PG-13")
    expect(svg).toContain("<rect")
    expect(svg.indexOf("2024")).toBeLessThan(svg.indexOf("PG-13"))
  })
  it("can show only the age tag", () => {
    const svg = buildGenreTextSvg("", "", "", 16, "#fff", "shadow", 0, { showGenre: false, showYear: false, showRating: false, ageRating: "TV-MA" }, "").svg
    expect(svg).toContain("TV-MA")
  })
})

describe("resolvePosterRenderConfig with server defaults only (plugin request)", () => {
  const base = {
    searchParams: new URLSearchParams("lang=en"), mapping: null, configOverride: null, hasQuery: false,
    showBadges: true, rankingBadges: true, animeRank: null, rankingResult: null, finalRank: null,
  }
  it("applies saved blur, ribbon, badge switches, sources and age rating", () => {
    const c = resolvePosterRenderConfig({
      ...base,
      sd: { blurEnabled: false, blurIntensity: 20, gradientHeight: 50, ribbonSide: "right", globalBadges: false, rankingBadges: false, ratingSources: ["imdb"], ageRating: true },
    })
    expect(c).toMatchObject({ blurEnabled: false, blurIntensity: 20, blurHeight: 50, ribbonSide: "right", badgesEnabled: false, rankingEnabled: false, ageRating: true })
    expect(c.ratingSources).toEqual(["imdb"])
  })
  it("keeps the old behaviour with no saved defaults, and ar=1 overrides", () => {
    const c = resolvePosterRenderConfig({ ...base, sd: {} })
    expect(c).toMatchObject({ blurEnabled: true, blurIntensity: 5, badgesEnabled: true, ageRating: false, ribbonSide: "left" })
    const q = resolvePosterRenderConfig({ ...base, searchParams: new URLSearchParams("ar=1"), sd: {} })
    expect(q.ageRating).toBe(true)
  })
})

import { serverDefaultsDiffer } from "@/lib/useDefaults"
describe("serverDefaultsDiffer", () => {
  it("detects settings the server never received", () => {
    expect(serverDefaultsDiffer({}, { ageRating: true })).toBe(true)
    expect(serverDefaultsDiffer({ ageRating: true, ratingSources: ["imdb"] }, { ageRating: true, ratingSources: ["imdb"] })).toBe(false)
    expect(serverDefaultsDiffer({ blurIntensity: 5, extra: 1 }, { blurIntensity: 22 })).toBe(true)
  })
})
