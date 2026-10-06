import { envWithFallback } from "@/lib/env-compat"

/**
 * Jellyfin integration: lists the Jellyfin library and replaces one item's
 * Primary poster at a time with the poster rendered by SpatialPosters.
 *
 * Configured only from the server environment (never from request input):
 *   SPATIALPOSTERS_JELLYFIN_URL      e.g. http://jellyfin:8096
 *   SPATIALPOSTERS_JELLYFIN_API_KEY  Jellyfin Dashboard > API Keys
 */

export class JellyfinError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.name = "JellyfinError"
    this.status = status
  }
}

export interface JellyfinConfig {
  url: string
  apiKey: string
}

export interface JellyfinItem {
  id: string
  name: string
  year: number | null
  type: "Movie" | "Series"
  tmdbId: string | null
  hasPoster: boolean
}

const PAGE_LIMIT = 500
const ITEMS_TTL_MS = 5 * 60 * 1000
const RENDER_FETCH_TIMEOUT_MS = 60_000
const ITEM_ID_RE = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i

// Kept on globalThis so Next's dev hot-reload does not drop the library cache.
interface Store {
  items: { at: number; list: JellyfinItem[] } | null
}
const g = globalThis as unknown as { __spJellyfin?: Store }
const store: Store = (g.__spJellyfin ??= { items: null })

/** Test helper: clears the library cache. */
export function __resetJellyfinState(): void {
  store.items = null
}

export function getJellyfinConfig(): JellyfinConfig | null {
  const rawUrl = (envWithFallback("JELLYFIN_URL") || process.env.JELLYFIN_URL || "").trim()
  const apiKey = (envWithFallback("JELLYFIN_API_KEY") || process.env.JELLYFIN_API_KEY || "").trim()
  if (!rawUrl || !apiKey) return null
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
  return { url: parsed.toString().replace(/\/+$/, ""), apiKey }
}

function requireConfig(): JellyfinConfig {
  const cfg = getJellyfinConfig()
  if (!cfg) throw new JellyfinError("Jellyfin is not configured", 400)
  return cfg
}

/** Jellyfin item ids are GUIDs (32 hex, or dashed). Anything else never reaches a URL. */
export function isValidItemId(id: unknown): id is string {
  return typeof id === "string" && ITEM_ID_RE.test(id)
}

function normalizeId(id: string): string {
  return id.replace(/-/g, "").toLowerCase()
}

function errorReason(e: unknown): string {
  if (!(e instanceof Error)) return String(e)
  const cause = (e as { cause?: unknown }).cause
  if (cause instanceof Error && cause.message) return cause.message
  return e.message
}

async function jfFetch(
  cfg: JellyfinConfig,
  pathAndQuery: string,
  init: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set("Authorization", `MediaBrowser Token="${cfg.apiKey}"`)
  try {
    return await fetch(`${cfg.url}${pathAndQuery}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    })
  } catch (e) {
    throw new JellyfinError(`Could not reach Jellyfin at ${cfg.url} (${errorReason(e)})`, 502)
  }
}

async function assertOk(res: Response, what: string): Promise<void> {
  if (res.ok) return
  if (res.status === 401 || res.status === 403) {
    throw new JellyfinError(`Jellyfin rejected the API key (HTTP ${res.status}). Check SPATIALPOSTERS_JELLYFIN_API_KEY.`, 502)
  }
  throw new JellyfinError(`${what} failed (Jellyfin HTTP ${res.status})`, 502)
}

interface RawItem {
  Id?: string
  Name?: string
  ProductionYear?: number
  Type?: string
  ProviderIds?: Record<string, string>
  ImageTags?: Record<string, string>
}

export async function fetchLibraryItems(): Promise<JellyfinItem[]> {
  const cfg = requireConfig()
  const items: JellyfinItem[] = []
  let start = 0
  for (;;) {
    const qs = new URLSearchParams({
      Recursive: "true",
      IncludeItemTypes: "Movie,Series",
      Fields: "ProviderIds",
      SortBy: "SortName",
      SortOrder: "Ascending",
      StartIndex: String(start),
      Limit: String(PAGE_LIMIT),
    })
    const res = await jfFetch(cfg, `/Items?${qs.toString()}`)
    await assertOk(res, "Listing the Jellyfin library")
    const page = (await res.json()) as { Items?: RawItem[]; TotalRecordCount?: number }
    const batch = page.Items ?? []
    for (const raw of batch) {
      if (!raw.Id) continue
      const providerIds = raw.ProviderIds ?? {}
      const tmdb = providerIds.Tmdb ?? providerIds.tmdb ?? null
      items.push({
        id: raw.Id,
        name: raw.Name ?? "",
        year: typeof raw.ProductionYear === "number" ? raw.ProductionYear : null,
        type: raw.Type === "Series" ? "Series" : "Movie",
        tmdbId: tmdb && /^\d+$/.test(tmdb) ? tmdb : null,
        hasPoster: Boolean(raw.ImageTags?.Primary),
      })
    }
    start += batch.length
    if (batch.length === 0 || start >= (page.TotalRecordCount ?? 0)) return items
  }
}

export async function getLibraryItems(refresh = false): Promise<JellyfinItem[]> {
  const cached = store.items
  if (!refresh && cached && Date.now() - cached.at < ITEMS_TTL_MS) return cached.list
  const list = await fetchLibraryItems()
  store.items = { at: Date.now(), list }
  return list
}

export async function findItem(id: string): Promise<JellyfinItem> {
  const wanted = normalizeId(id)
  let item = (await getLibraryItems(false)).find((i) => normalizeId(i.id) === wanted)
  if (!item) item = (await getLibraryItems(true)).find((i) => normalizeId(i.id) === wanted)
  if (!item) throw new JellyfinError("Item not found in Jellyfin", 404)
  return item
}

/** The poster Jellyfin currently shows for an item, or null when it has none. */
export async function fetchCurrentPoster(id: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const cfg = requireConfig()
  const res = await jfFetch(cfg, `/Items/${id}/Images/Primary?maxWidth=400&quality=85`)
  if (res.status === 404) return null
  await assertOk(res, "Reading the Jellyfin poster")
  return { body: await res.arrayBuffer(), contentType: res.headers.get("content-type") || "image/jpeg" }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Renders the poster through this instance's own /api/poster route, so the
 * image sent to Jellyfin is exactly what the preview shows (same saved
 * defaults, caches and render pipeline).
 */
export function buildRenderUrl(item: JellyfinItem, posterUrl?: string): string {
  if (!item.tmdbId) throw new JellyfinError("This item has no TMDB ID in Jellyfin", 422)
  const kind = item.type === "Movie" ? "movie" : "tv"
  const base = `http://127.0.0.1:${process.env.PORT || "3000"}`
  const expectedPath = `/api/poster/${kind}/${item.tmdbId}`
  const params = new URLSearchParams()
  if (posterUrl) {
    if (posterUrl.length > 8192) throw new JellyfinError("Poster URL is too long", 400)
    let parsed: URL
    try {
      parsed = new URL(posterUrl, "http://placeholder.invalid")
    } catch {
      throw new JellyfinError("Invalid poster URL", 400)
    }
    // Only this title's own poster route may be fetched: never an arbitrary URL.
    if (parsed.pathname !== expectedPath) throw new JellyfinError("Poster URL does not match this Jellyfin item", 400)
    parsed.searchParams.forEach((v, k) => params.append(k, v))
  }
  params.set("fmt", "jpeg")
  return `${base}${expectedPath}?${params.toString()}`
}

export async function renderSpatialPoster(
  item: JellyfinItem,
  posterUrl?: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const url = buildRenderUrl(item, posterUrl)
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(RENDER_FETCH_TIMEOUT_MS), cache: "no-store" })
    } catch (e) {
      throw new JellyfinError(`Could not render the poster (${errorReason(e)})`, 502)
    }
    if ((res.status === 429 || res.status === 503) && attempt < 2) {
      const retryAfter = Number(res.headers.get("retry-after"))
      await sleep(Math.min(10, Math.max(1, Number.isFinite(retryAfter) ? retryAfter : 2)) * 1000)
      continue
    }
    if (!res.ok) throw new JellyfinError(`Poster render failed for TMDB ${item.tmdbId} (HTTP ${res.status})`, 502)
    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim()
    const bytes = Buffer.from(await res.arrayBuffer())
    if (!contentType.startsWith("image/") || bytes.length < 500) {
      throw new JellyfinError(`Poster render for TMDB ${item.tmdbId} returned ${contentType || "no content type"}, not an image`, 502)
    }
    return { bytes, contentType }
  }
  throw new JellyfinError("The poster renderer is busy, try again in a moment", 503)
}

export async function uploadPrimaryPoster(id: string, poster: { bytes: Buffer; contentType: string }): Promise<void> {
  const cfg = requireConfig()
  // Jellyfin's image upload endpoint expects the image bytes base64-encoded.
  const res = await jfFetch(
    cfg,
    `/Items/${id}/Images/Primary`,
    { method: "POST", headers: { "Content-Type": poster.contentType }, body: poster.bytes.toString("base64") },
    120_000,
  )
  await assertOk(res, "Uploading the poster to Jellyfin")
}

/** Renders the poster and replaces the item's Primary image in Jellyfin. */
export async function applyPoster(id: string, posterUrl?: string): Promise<{ name: string }> {
  const item = await findItem(id)
  const poster = await renderSpatialPoster(item, posterUrl)
  await uploadPrimaryPoster(item.id, poster)
  item.hasPoster = true
  return { name: item.name }
}
