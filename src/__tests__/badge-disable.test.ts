// @vitest-environment node
import { describe, it, expect } from "vitest"
import { computeTopBadge, type BadgeInput } from "@/lib/poster-badge"

const t = (k: string) => k
const ended: BadgeInput = {
  mediaType: "tv", releaseDate: null, firstAirDate: "2015-01-01", lastAirDate: "2019-01-01", seasonCount: 5,
  originCountries: [], voteAverage: 8, trendRank: null, animeRank: null, awards: [], nominations: [], studios: [],
  director: null, tvType: "Scripted", tvStatus: "Ended",
}

describe("disabledBadges", () => {
  it("shows Binge Worthy for an ended series by default", () => {
    expect(computeTopBadge(ended, t).badge?.label).toBe("badge.bingeWorthy")
  })
  it("suppresses it when switched off, falling back to the next badge or none", () => {
    expect(computeTopBadge({ ...ended, disabledBadges: ["bingeWorthy"] }, t).badge).toBeNull()
    const withDirector = computeTopBadge({ ...ended, director: "Jane Doe", disabledBadges: ["bingeWorthy"] }, t)
    expect(withDirector.badge?.label).toBe("Jane Doe")
    expect(computeTopBadge({ ...ended, director: "Jane Doe", disabledBadges: ["bingeWorthy", "director"] }, t).badge).toBeNull()
  })
})
