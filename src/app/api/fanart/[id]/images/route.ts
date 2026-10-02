import { NextRequest } from "next/server"
import { getFanartPosters, FanartError, fanartProjectKey } from "@/lib/fanart"
import { envWithFallback } from "@/lib/env-compat"
import { rateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit"
import { cacheGet, cacheSet } from "@/lib/cache"

type RouteParams = { id: string }

/**
 * GET /api/fanart/[id]/images?type=movie|tv
 * High-resolution Fanart.tv posters endpoint.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<RouteParams> }) {
  const rl = await rateLimit(rateLimitKey(req), "fanart")
  if (!rl.ok) return rateLimitResponse(rl.retAfter)

  const { id } = await params
  const type = req.nextUrl.searchParams.get("type") || "movie"
  if (type !== "movie" && type !== "tv") {
    return Response.json({ error: "Invalid type: must be 'movie' or 'tv'" }, { status: 400 })
  }
  const tmdbId = Number(id)
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return Response.json({ error: "Invalid id: must be a positive integer" }, { status: 400 })
  }

  const fanartKey = fanartProjectKey()
  const tmdbKey = envWithFallback("TMDB_KEY") || process.env.TMDB_KEY || process.env.TMDB_API_KEY

  if (!fanartKey) {
    return Response.json(
      { error: "Fanart.tv is not configured on this instance", code: "fanart_not_configured" },
      { status: 503 }
    )
  }

  const cacheKey = `fanart:images:${type}:${id}`
  const cached = cacheGet<{ posters: unknown[]; source: string }>(cacheKey)
  if (cached) return Response.json(cached)

  let posters: Awaited<ReturnType<typeof getFanartPosters>>
  try {
    posters = await getFanartPosters(
      type,
      tmdbId,
      { tmdbApiKey: tmdbKey, fanartKey },
      req.signal
    )
  } catch (e) {
    if (e instanceof FanartError && e.code === "auth") {
      return Response.json({ error: "Fanart.tv rejected the project key", code: "fanart_auth_error" }, { status: 502 })
    }
    return Response.json({ error: "Fanart.tv unavailable", code: "fanart_unavailable" }, { status: 502 })
  }

  const data = { posters, source: "fanart" }
  cacheSet(cacheKey, data, ["fanart", "images"], posters.length > 0 ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000)
  return Response.json(data)
}
