import sharp from "sharp"
import { getCertificationData } from "@/lib/tmdb"
import { envWithFallback } from "@/lib/env-compat"
import { escSvg } from "@/lib/badge-svg-shared"

/**
 * Age rating ("PG-13", "TV-MA", "12"…) from TMDB certifications.
 * Country: SPATIALPOSTERS_AGE_RATING_COUNTRY (ISO 3166-1, default US), falling back to US.
 */
export function ageRatingCountry(): string {
  const raw = (envWithFallback("AGE_RATING_COUNTRY") || "").trim().toUpperCase()
  return /^[A-Z]{2}$/.test(raw) ? raw : "US"
}

interface MovieReleaseDates {
  results?: { iso_3166_1?: string; release_dates?: { certification?: string; type?: number }[] }[]
}
interface TvContentRatings {
  results?: { iso_3166_1?: string; rating?: string }[]
}

/** Pure: picks the certification for the preferred countries, in order. */
export function pickCertification(mediaType: "movie" | "tv", data: unknown, countries: string[]): string | null {
  if (!data || typeof data !== "object") return null
  for (const country of countries) {
    if (mediaType === "tv") {
      const hit = (data as TvContentRatings).results?.find((r) => r.iso_3166_1 === country && r.rating?.trim())
      if (hit?.rating) return clean(hit.rating)
    } else {
      const entry = (data as MovieReleaseDates).results?.find((r) => r.iso_3166_1 === country)
      const certs = (entry?.release_dates ?? []).filter((d) => d.certification?.trim())
      // Prefer theatrical (3) then digital/physical (4/5), then anything else.
      const best = [3, 4, 5, 2, 1, 6].map((t) => certs.find((c) => c.type === t)).find(Boolean) ?? certs[0]
      if (best?.certification) return clean(best.certification)
    }
  }
  return null
}

function clean(label: string): string {
  return label.trim().replace(/\s+/g, " ").slice(0, 10)
}

export async function fetchAgeRating(
  mediaType: "movie" | "tv",
  tmdbId: number,
  apiKey: string | undefined,
  signal?: AbortSignal,
): Promise<string | null> {
  const country = ageRatingCountry()
  const data = await getCertificationData(mediaType, tmdbId, apiKey, signal)
  return pickCertification(mediaType, data, country === "US" ? ["US"] : [country, "US"])
}

/** Small outlined pill with the rating text; sized relative to the poster width. */
export async function renderAgeRatingBadge(
  label: string,
  pw: number,
): Promise<{ png: Buffer; w: number; h: number }> {
  const fs = Math.round(Math.max(15 * pw / 380, 11))
  const padX = Math.round(fs * 0.7)
  const h = Math.round(fs * 1.9)
  const textW = Math.round(label.length * fs * 0.68)
  const w = textW + padX * 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="${Math.round(h * 0.25)}" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.9)" stroke-width="2"/>
  <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="central" font-family="Inter, Arial, Helvetica, sans-serif" font-weight="700" font-size="${fs}" fill="#fff">${escSvg(label)}</text>
</svg>`
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  return { png, w, h }
}
