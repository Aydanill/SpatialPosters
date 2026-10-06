// @vitest-environment node
import { describe, it, expect } from "vitest"
import { pickCertification, renderAgeRatingBadge } from "@/lib/age-rating"
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

describe("renderAgeRatingBadge", () => {
  it("renders a PNG with positive size", async () => {
    const b = await renderAgeRatingBadge("PG-13", 500)
    expect(b.w).toBeGreaterThan(20)
    expect(b.png.subarray(1, 4).toString()).toBe("PNG")
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
