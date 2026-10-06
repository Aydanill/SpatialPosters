// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET as itemsGET } from "@/app/api/jellyfin/items/route"
import { GET as imageGET } from "@/app/api/jellyfin/image/[id]/route"
import { POST as applyPOST } from "@/app/api/jellyfin/apply/route"
import { buildRenderUrl, __resetJellyfinState, type JellyfinItem } from "@/lib/jellyfin"
import { _resetPinCache } from "@/lib/pin-auth"

const TOKEN = "route-test-secret"
const ID = "a".repeat(32)
const BASE = "http://localhost:3000"
const authed = { "x-admin-token": TOKEN }

const get = (p: string, h: Record<string, string> = {}) => new NextRequest(`${BASE}${p}`, { headers: h })
const post = (body: unknown, h: Record<string, string> = {}) =>
  new NextRequest(`${BASE}/api/jellyfin/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...h },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })

describe("/api/jellyfin routes", () => {
  beforeEach(() => {
    vi.stubEnv("SPATIALPOSTERS_ADMIN_TOKEN", TOKEN)
    vi.stubEnv("SPATIALPOSTERS_JELLYFIN_URL", "")
    vi.stubEnv("SPATIALPOSTERS_JELLYFIN_API_KEY", "")
    _resetPinCache()
    __resetJellyfinState()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("refuses requests without admin access", async () => {
    expect((await itemsGET(get("/api/jellyfin/items"))).status).toBe(401)
    expect((await applyPOST(post({ id: ID }))).status).toBe(401)
    const img = await imageGET(get(`/api/jellyfin/image/${ID}`), { params: Promise.resolve({ id: ID }) })
    expect(img.status).toBe(401)
  })

  it("reports an unconfigured server", async () => {
    const res = await itemsGET(get("/api/jellyfin/items", authed))
    expect(await res.json()).toEqual({ configured: false, items: [] })
  })

  it("rejects cross-origin writes", async () => {
    const res = await applyPOST(post({ id: ID }, { ...authed, origin: "https://evil.example", host: "localhost:3000" }))
    expect(res.status).toBe(403)
  })

  it("apply validates the body", async () => {
    vi.stubEnv("SPATIALPOSTERS_JELLYFIN_URL", "http://jf.test:8096")
    vi.stubEnv("SPATIALPOSTERS_JELLYFIN_API_KEY", "k")
    expect((await applyPOST(post("{nope", authed))).status).toBe(400)
    expect((await applyPOST(post({}, authed))).status).toBe(400)
    expect((await applyPOST(post({ id: "../../etc" }, authed))).status).toBe(400)
  })

  it("apply says so when Jellyfin is not configured", async () => {
    const res = await applyPOST(post({ id: ID }, authed))
    expect(res.status).toBe(400)
  })

  it("lists items and sends the poster for one item to Jellyfin", async () => {
    vi.stubEnv("SPATIALPOSTERS_JELLYFIN_URL", "http://jf.test:8096")
    vi.stubEnv("SPATIALPOSTERS_JELLYFIN_API_KEY", "k")
    const calls: { url: string; method?: string; body?: unknown }[] = []
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input)
      calls.push({ url, method: init?.method, body: init?.body })
      if (url.startsWith("http://jf.test:8096/Items?"))
        return Response.json({
          TotalRecordCount: 1,
          Items: [{ Id: ID, Name: "The Matrix", ProductionYear: 1999, Type: "Movie", ProviderIds: { Tmdb: "603" } }],
        })
      if (url.startsWith("http://127.0.0.1:")) return new Response(new Uint8Array(2000), { headers: { "content-type": "image/jpeg" } })
      if (url.includes("/Images/Primary")) return new Response(null, { status: 204 })
      return new Response("", { status: 404 })
    })
    const list = await (await itemsGET(get("/api/jellyfin/items", authed))).json()
    expect(list.items[0]).toMatchObject({ id: ID, tmdbId: "603", type: "Movie" })

    const res = await applyPOST(post({ id: ID, posterUrl: "/api/poster/movie/603?lang=en&fmt=png" }, authed))
    expect(res.status).toBe(200)
    const render = calls.find((c) => c.url.startsWith("http://127.0.0.1:"))!
    expect(render.url).toContain("/api/poster/movie/603?")
    expect(render.url).toContain("fmt=jpeg")
    expect(render.url).not.toContain("fmt=png")
    const up = calls.find((c) => c.method === "POST")!
    expect(up.url).toBe(`http://jf.test:8096/Items/${ID}/Images/Primary`)
  })
})

describe("buildRenderUrl", () => {
  const item: JellyfinItem = { id: ID, name: "x", year: null, type: "Series", tmdbId: "1396", hasPoster: true }
  it("only allows this title's own poster route", () => {
    expect(() => buildRenderUrl(item, "/api/poster/movie/1396")).toThrow()
    expect(() => buildRenderUrl(item, "http://evil.example/api/poster/tv/999")).toThrow()
    expect(buildRenderUrl(item, "http://x.test/api/poster/tv/1396?a=1")).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/api\/poster\/tv\/1396\?a=1&fmt=jpeg$/)
    expect(buildRenderUrl(item)).toMatch(/\/api\/poster\/tv\/1396\?fmt=jpeg$/)
  })
  it("rejects items without a TMDB id", () => {
    expect(() => buildRenderUrl({ ...item, tmdbId: null })).toThrow(/TMDB/)
  })
})
