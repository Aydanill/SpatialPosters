// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { JellyfinItem } from "@/lib/jellyfin"

const saved = new Map<string, unknown>()
vi.mock("@/lib/store", () => ({
  getById: async (t: string, id: number) => saved.get(`${t}:${id}`) ?? null,
  importMappings: async (ms: { mediaType: string; tmdbId: number }[]) => {
    for (const m of ms) saved.set(`${m.mediaType}:${m.tmdbId}`, m)
  },
}))
vi.mock("@/lib/cache", () => ({ cacheInvalidatePosterData: vi.fn() }))
vi.mock("@/lib/catalog-epoch", () => ({ bumpCatalogEpoch: vi.fn(async () => {}) }))
vi.mock("@/lib/tmdb", () => ({
  getDetails: async (_t: string, id: number) => {
    if (id === 3) throw new Error("boom")
    if (id === 4) return { title: "No Poster", poster_path: null }
    return { title: `T${id}`, name: undefined, poster_path: `/p${id}.jpg` }
  },
}))

import { importLibrary } from "@/lib/jellyfin-import"

const item = (id: string, tmdbId: string | null, type: "Movie" | "Series" = "Movie"): JellyfinItem => ({
  id, name: `Item ${id}`, year: 2000, type, tmdbId, hasPoster: true,
})

describe("importLibrary", () => {
  beforeEach(() => saved.clear())

  it("imports new titles and skips existing, missing-id and failing ones", async () => {
    saved.set("movie:2", { tmdbId: 2 })
    const r = await importLibrary([
      item("a", "1"), item("b", "2"), item("c", null), item("d", "3"), item("e", "4"), item("f", "5", "Series"),
    ])
    expect(r).toEqual({ imported: 2, skippedExisting: 1, skippedNoTmdb: 1, failed: 2 })
    expect(saved.get("movie:1")).toMatchObject({ title: "T1", posterPath: "/p1.jpg", mediaType: "movie" })
    expect(saved.get("tv:5")).toMatchObject({ mediaType: "tv" })
    expect(saved.get("movie:2")).toEqual({ tmdbId: 2 })
  })
})
