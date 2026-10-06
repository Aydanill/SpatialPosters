"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"

interface Item {
  id: string
  name: string
  year: number | null
  type: "Movie" | "Series"
  tmdbId: string | null
  hasPoster: boolean
}

type State =
  | { kind: "loading" }
  | { kind: "unconfigured" }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: Item[] }

export function editorHref(item: Item): string | null {
  if (!item.tmdbId) return null
  return `/${item.type === "Movie" ? "movie" : "tv"}/${item.tmdbId}?jellyfin=${item.id}`
}

export function JellyfinLibrary() {
  const [state, setState] = useState<State>({ kind: "loading" })
  const [search, setSearch] = useState("")
  const [type, setType] = useState("")

  const load = useCallback(async (refresh = false) => {
    setState({ kind: "loading" })
    try {
      const res = await fetch(`/api/jellyfin/items${refresh ? "?refresh=1" : ""}`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401 || res.status === 403) return setState({ kind: "denied" })
      if (!res.ok) return setState({ kind: "error", message: data.error || `HTTP ${res.status}` })
      if (!data.configured) return setState({ kind: "unconfigured" })
      setState({ kind: "ready", items: data.items as Item[] })
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Network error" })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(() => {
    if (state.kind !== "ready") return []
    const q = search.trim().toLowerCase()
    return state.items.filter((i) => (!type || i.type === type) && (!q || i.name.toLowerCase().includes(q)))
  }, [state, search, type])

  if (state.kind === "loading") return <p className="text-sm text-zinc-400">Loading your Jellyfin library…</p>
  if (state.kind === "denied")
    return (
      <Notice title="Admin access needed">
        Set <code>SPATIALPOSTERS_ADMIN_PIN</code> in the compose file, then unlock this page with that PIN.
      </Notice>
    )
  if (state.kind === "unconfigured")
    return (
      <Notice title="Jellyfin isn't configured">
        Set <code>SPATIALPOSTERS_JELLYFIN_URL</code> and <code>SPATIALPOSTERS_JELLYFIN_API_KEY</code>, then restart.
      </Notice>
    )
  if (state.kind === "error")
    return (
      <Notice title="Couldn't load Jellyfin">
        {state.message}
        <button className="ml-3 underline" onClick={() => load()}>
          Try again
        </button>
      </Notice>
    )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          aria-label="Search title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm"
        />
        <select
          aria-label="Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-sm"
        >
          <option value="">Movies and shows</option>
          <option value="Movie">Movies</option>
          <option value="Series">Shows</option>
        </select>
        <button
          onClick={() => load(true)}
          className="inline-flex items-center gap-2 text-sm bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        <span className="text-xs text-zinc-400">
          {shown.length} of {state.items.length} shown
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {shown.map((item) => {
          const href = editorHref(item)
          const card = (
            <div data-testid="jellyfin-card" className="group">
              <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/[0.04] border border-white/10">
                {item.hasPoster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/jellyfin/image/${item.id}`} alt="" loading="lazy" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="mt-2 text-xs font-semibold text-zinc-100 truncate">
                {item.name}
                {item.year ? ` (${item.year})` : ""}
              </div>
              <div className="text-[10px] text-zinc-400">{href ? "Edit poster" : "No TMDB ID in Jellyfin"}</div>
            </div>
          )
          return href ? (
            <Link key={item.id} href={href}>
              {card}
            </Link>
          ) : (
            <div key={item.id} className="opacity-50">
              {card}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="font-bold text-zinc-100 mb-1">{title}</div>
      <div className="text-sm text-zinc-300">{children}</div>
    </div>
  )
}
