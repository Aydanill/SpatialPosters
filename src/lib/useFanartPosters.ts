"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { TMDBImage } from "@/lib/types"
import { usePSelector } from "@/lib/context"

export interface FanartTabMeta {
  readonly lang: string | null
  readonly likes: number
}

export type FanartTabStatus = "idle" | "loading" | "ready" | "empty" | "unavailable" | "not_configured"

export interface FanartTabData {
  readonly status: FanartTabStatus
  readonly posters: TMDBImage[]
  readonly meta: FanartTabMeta[]
  readonly reload: () => void
}

interface FanartApiPoster {
  url: string
  lang: string | null
  likes: number
}

/**
 * Hook for loading Fanart.tv posters lazily when the Fanart tab is active.
 */
export function useFanartPosters(enabled: boolean): FanartTabData {
  const selected = usePSelector((v) => v.selected)
  const key = selected ? `${selected.media_type}:${selected.id}` : null

  const [status, setStatus] = useState<FanartTabStatus>("idle")
  const [posters, setPosters] = useState<TMDBImage[]>([])
  const [meta, setMeta] = useState<FanartTabMeta[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const keyRef = useRef<string | null>(null)
  keyRef.current = key

  const load = useCallback(async () => {
    const current = keyRef.current
    const sel = selected
    if (!sel || !current) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setStatus("loading")
    try {
      const mediaType = sel.media_type === "tv" ? "tv" : "movie"
      const res = await fetch(`/api/fanart/${sel.id}/images?type=${mediaType}`, { signal: ctrl.signal })
      const data = (await res.json().catch(() => null)) as
        | { posters?: FanartApiPoster[]; code?: string; error?: string }
        | null
      if (ctrl.signal.aborted || keyRef.current !== current) return
      if (res.status === 503 || data?.code === "fanart_not_configured") {
        setStatus("not_configured")
        return
      }
      if (!res.ok || !data || !Array.isArray(data.posters)) {
        setStatus("unavailable")
        return
      }
      if (data.posters.length === 0) {
        setPosters([])
        setMeta([])
        setStatus("empty")
        return
      }
      const items = data.posters.filter((p) => typeof p?.url === "string")
      setPosters(
        items.map((p) => ({
          file_path: p.url,
          iso_639_1: null,
          vote_average: 0,
          width: 0,
          height: 0,
        }))
      )
      setMeta(items.map((p) => ({ lang: p.lang ?? null, likes: p.likes ?? 0 })))
      setStatus("ready")
    } catch {
      if (ctrl.signal.aborted || keyRef.current !== current) return
      setStatus("unavailable")
    }
  }, [selected])

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus("idle")
    setPosters([])
    setMeta([])
  }, [key])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (enabled && selected && status === "idle") void load()
  }, [enabled, selected, status, load])

  return { status, posters, meta, reload: load }
}
