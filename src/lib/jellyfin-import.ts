import { getById, importMappings } from "@/lib/store"
import { getDetails } from "@/lib/tmdb"
import { cacheInvalidatePosterData } from "@/lib/cache"
import { bumpCatalogEpoch } from "@/lib/catalog-epoch"
import type { JellyfinItem } from "@/lib/jellyfin"
import type { Mapping } from "@/lib/types"

export interface ImportResult {
  imported: number
  skippedExisting: number
  /** Already-saved titles that were missing rating/genre/date info and got it filled in. */
  updatedExisting: number
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
  const result: ImportResult = { imported: 0, skippedExisting: 0, updatedExisting: 0, skippedNoTmdb: 0, failed: 0 }
  const todo: { item: JellyfinItem; tmdbId: number; mediaType: "movie" | "tv"; existing?: Mapping }[] = []
  for (const item of items) {
    const tmdbId = Number(item.tmdbId)
    if (!item.tmdbId || !Number.isInteger(tmdbId) || tmdbId <= 0) {
      result.skippedNoTmdb++
      continue
    }
    const mediaType = item.type === "Movie" ? "movie" : "tv"
    const existing = await getById(mediaType, tmdbId)
    if (existing) {
      // Saved titles are never overwritten, but ones without TMDB info (rating,
      // genre, dates) can't draw those badges, so fill only what's missing.
      if (existing.voteAverage == null || existing.voteAverage <= 0) todo.push({ item, tmdbId, mediaType, existing })
      else result.skippedExisting++
      continue
    }
    todo.push({ item, tmdbId, mediaType })
  }

  const created: Mapping[] = []
  let next = 0
  const worker = async () => {
    while (next < todo.length) {
      const { item, tmdbId, mediaType, existing } = todo[next++]
      try {
        const d = await getDetails(mediaType, tmdbId, "en-US", apiKey)
        if (existing) {
          created.push({
            ...existing,
            genreName: existing.genreName ?? d.genres?.[0]?.name ?? null,
            voteAverage: d.vote_average > 0 ? d.vote_average : (existing.voteAverage ?? null),
            releaseDate: existing.releaseDate ?? d.release_date ?? null,
            firstAirDate: existing.firstAirDate ?? d.first_air_date ?? null,
            tvType: existing.tvType ?? d.type ?? null,
            tvStatus: existing.tvStatus ?? d.status ?? null,
          })
          result.updatedExisting++
          continue
        }
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
          genreName: d.genres?.[0]?.name ?? null,
          voteAverage: d.vote_average > 0 ? d.vote_average : null,
          releaseDate: d.release_date ?? null,
          firstAirDate: d.first_air_date ?? null,
          tvType: d.type ?? null,
          tvStatus: d.status ?? null,
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
  result.imported = created.length - result.updatedExisting
  return result
}
