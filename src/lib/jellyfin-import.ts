import { getById, importMappings } from "@/lib/store"
import { getDetails } from "@/lib/tmdb"
import { cacheInvalidatePosterData } from "@/lib/cache"
import { bumpCatalogEpoch } from "@/lib/catalog-epoch"
import type { JellyfinItem } from "@/lib/jellyfin"
import type { Mapping } from "@/lib/types"

export interface ImportResult {
  imported: number
  skippedExisting: number
  skippedNoTmdb: number
  failed: number
}

const CONCURRENCY = 6

/**
 * Saves every Jellyfin title that has a TMDB id as a poster in the
 * SpatialPosters ("My Posters") list. Titles already saved are left alone,
 * so their edits are never overwritten.
 */
export async function importLibrary(items: JellyfinItem[], apiKey?: string): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skippedExisting: 0, skippedNoTmdb: 0, failed: 0 }
  const todo: { item: JellyfinItem; tmdbId: number; mediaType: "movie" | "tv" }[] = []
  for (const item of items) {
    const tmdbId = Number(item.tmdbId)
    if (!item.tmdbId || !Number.isInteger(tmdbId) || tmdbId <= 0) {
      result.skippedNoTmdb++
      continue
    }
    const mediaType = item.type === "Movie" ? "movie" : "tv"
    if (await getById(mediaType, tmdbId)) {
      result.skippedExisting++
      continue
    }
    todo.push({ item, tmdbId, mediaType })
  }

  const created: Mapping[] = []
  let next = 0
  const worker = async () => {
    while (next < todo.length) {
      const { item, tmdbId, mediaType } = todo[next++]
      try {
        const d = await getDetails(mediaType, tmdbId, "en-US", apiKey)
        if (!d.poster_path) {
          result.failed++
          continue
        }
        created.push({
          tmdbId,
          mediaType,
          title: d.title || d.name || item.name,
          posterPath: d.poster_path,
          logoPath: null,
          originalPosterPath: d.poster_path,
          language: "en",
          updatedAt: new Date().toISOString(),
        })
      } catch {
        result.failed++
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker))

  if (created.length > 0) {
    await importMappings(created)
    cacheInvalidatePosterData()
    await bumpCatalogEpoch()
  }
  result.imported = created.length
  return result
}
