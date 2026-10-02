import { z } from "zod"
import { createLogger } from "@/lib/logger"
import { envWithFallback } from "@/lib/env-compat"

const log = createLogger("fanart")

const FANART_BASE = process.env.FANART_API_URL || "https://webservice.fanart.tv/v3"

export const FANART_TIMEOUT_MS = 5000
export const FANART_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const FANART_EMPTY_TTL_MS = 10 * 60 * 1000
const FANART_CACHE_MAX = 500

export interface FanartPoster {
  readonly url: string
  readonly lang: string | null
  readonly likes: number
  readonly width?: number
  readonly height?: number
}

export type FanartMediaType = "movie" | "tv"

export class FanartError extends Error {
  readonly code: "not_configured" | "auth" | "upstream" | "timeout"
  constructor(code: FanartError["code"], message: string) {
    super(message)
    this.code = code
  }
}

const fanartItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  url: z.string(),
  lang: z.string().nullable().optional(),
  likes: z.union([z.string(), z.number()]).nullable().optional(),
}).passthrough()

const fanartMovieSchema = z.object({
  movieposter: z.array(fanartItemSchema).optional(),
}).passthrough()

const fanartTvSchema = z.object({
  tvposter: z.array(fanartItemSchema).optional(),
}).passthrough()

function toLikes(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
  if (typeof raw === "string") {
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  return 0
}

export function normalizeFanartPosters(items: readonly unknown[]): FanartPoster[] {
  const byUrl = new Map<string, FanartPoster>()
  for (const raw of items) {
    const parsed = fanartItemSchema.safeParse(raw)
    if (!parsed.success) continue
    const url = parsed.data.url.trim()
    if (!url.startsWith("http://") && !url.startsWith("https://")) continue
    const entry: FanartPoster = {
      url,
      lang: typeof parsed.data.lang === "string" && parsed.data.lang.length > 0 ? parsed.data.lang : null,
      likes: toLikes(parsed.data.likes),
    }
    const prev = byUrl.get(url)
    if (!prev || entry.likes > prev.likes) byUrl.set(url, entry)
  }
  return [...byUrl.values()].sort((a, b) => b.likes - a.likes)
}

export function fanartProjectKey(): string | undefined {
  const key = envWithFallback("FANART_KEY")
  return key && key.trim().length > 0 ? key.trim() : undefined
}

export interface FanartFetchOpts {
  tmdbApiKey?: string
  fanartKey?: string
}

interface FanartCacheEntry {
  posters: FanartPoster[]
  expiry: number
}

const fanartCache = new Map<string, FanartCacheEntry>()

function cacheKeyFor(type: FanartMediaType, id: number): string {
  return `${type}:${id}`
}

function cacheGetValid(key: string): FanartPoster[] | null {
  const entry = fanartCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    fanartCache.delete(key)
    return null
  }
  return entry.posters
}

function cacheSetBounded(key: string, posters: FanartPoster[], ttlMs: number): void {
  if (fanartCache.size >= FANART_CACHE_MAX) fanartCache.delete(fanartCache.keys().next().value!)
  fanartCache.set(key, { posters, expiry: Date.now() + ttlMs })
}

export function __resetFanartCache(): void {
  fanartCache.clear()
}

function isTimeoutError(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")
}

async function fetchFanartJson(path: string, apiKey: string, signal?: AbortSignal): Promise<Response> {
  const url = new URL(`${FANART_BASE}${path}`)
  url.searchParams.set("api_key", apiKey)
  const timeoutSignal = AbortSignal.timeout(FANART_TIMEOUT_MS)
  const effectiveSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
  return fetch(url.toString(), {
    signal: effectiveSignal,
    headers: { Accept: "application/json" },
  })
}

export async function getFanartPosters(
  type: FanartMediaType,
  tmdbId: number,
  opts?: FanartFetchOpts,
  signal?: AbortSignal
): Promise<FanartPoster[]> {
  const apiKey = opts?.fanartKey?.trim() || fanartProjectKey()
  if (!apiKey) throw new FanartError("not_configured", "Fanart.tv project key is not configured")
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return []

  const key = cacheKeyFor(type, tmdbId)
  const hit = cacheGetValid(key)
  if (hit) return hit

  const work = async (): Promise<FanartPoster[]> => {
    if (type === "movie") {
      const res = await fetchFanartJson(`/movies/${tmdbId}`, apiKey, signal)
      return await readPosterList(res, fanartMovieSchema, "movieposter")
    }
    let tvdbId: number | null = null
    try {
      const { getExternalIds } = await import("@/lib/tmdb")
      const ext = await getExternalIds("tv", tmdbId, opts?.tmdbApiKey, signal)
      tvdbId = ext?.tvdb_id && ext.tvdb_id > 0 ? ext.tvdb_id : null
    } catch {
      throw new FanartError("upstream", "TMDB external_ids unavailable")
    }
    if (!tvdbId) return []
    const res = await fetchFanartJson(`/tv/${tvdbId}`, apiKey, signal)
    return await readPosterList(res, fanartTvSchema, "tvposter")
  }

  let posters: FanartPoster[]
  try {
    posters = await work()
  } catch (e) {
    if (e instanceof FanartError) throw e
    if (isTimeoutError(e) || signal?.aborted) throw new FanartError("timeout", "Fanart.tv request timed out")
    log.warn("Fanart fetch failed", { type, tmdbId })
    throw new FanartError("upstream", "Fanart.tv unavailable")
  }
  cacheSetBounded(key, posters, posters.length > 0 ? FANART_CACHE_TTL_MS : FANART_EMPTY_TTL_MS)
  return posters
}

async function readPosterList(
  res: Response,
  schema: typeof fanartMovieSchema | typeof fanartTvSchema,
  field: "movieposter" | "tvposter"
): Promise<FanartPoster[]> {
  if (res.status === 404) return []
  if (res.status === 401 || res.status === 403) throw new FanartError("auth", "Fanart.tv rejected the project key")
  if (res.status === 429 || res.status >= 500) throw new FanartError("upstream", `Fanart.tv responded with status ${res.status}`)
  if (!res.ok) throw new FanartError("upstream", `Fanart.tv responded with status ${res.status}`)
  const json = (await res.json().catch(() => null)) as unknown
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    log.warn("Fanart response shape changed", { field })
    throw new FanartError("upstream", "Fanart.tv returned an unexpected response")
  }
  const raw = (parsed.data as Record<string, unknown[]>)[field]
  return normalizeFanartPosters(Array.isArray(raw) ? raw : [])
}
