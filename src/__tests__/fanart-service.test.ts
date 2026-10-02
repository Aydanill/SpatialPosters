import { describe, it, expect } from "vitest"
import { normalizeFanartPosters, FanartError } from "@/lib/fanart"

describe("fanart service", () => {
  it("normalizes and sorts Fanart posters by likes", () => {
    const raw = [
      { url: "https://assets.fanart.tv/fanart/movie/1/poster1.jpg", likes: 10, lang: "en" },
      { url: "https://assets.fanart.tv/fanart/movie/1/poster2.jpg", likes: 50, lang: "en" },
    ]
    const normalized = normalizeFanartPosters(raw)
    expect(normalized.length).toBe(2)
    expect(normalized[0].likes).toBe(50)
    expect(normalized[1].likes).toBe(10)
  })

  it("handles FanartError correctly", () => {
    const err = new FanartError("not_configured", "Missing key")
    expect(err.code).toBe("not_configured")
    expect(err.message).toBe("Missing key")
  })
})
