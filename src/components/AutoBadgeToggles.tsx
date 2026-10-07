"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Toggle } from "@/components/Toggle"

const OPTIONS: { key: string; label: string }[] = [
  { key: "bingeWorthy", label: "Binge Worthy (ended series)" },
  { key: "newEpisode", label: "New Episode" },
  { key: "newSeason", label: "New Season" },
  { key: "newMovie", label: "New Movie" },
  { key: "newSeries", label: "New Series" },
  { key: "newAnime", label: "New Anime" },
  { key: "award", label: "Awards" },
  { key: "nomination", label: "Nominations" },
  { key: "absoluteCinema", label: "Absolute Cinema (IMDb Top 250)" },
  { key: "subGenre", label: "Sub-genre" },
  { key: "kdrama", label: "K-Drama" },
  { key: "director", label: "Director name" },
  { key: "studio", label: "Studio name" },
]

/** Switch individual automatic top badges off. Saved on the server, so it also applies to the Jellyfin plugin. */
export function AutoBadgeToggles() {
  const [disabled, setDisabled] = useState<string[] | null>(null)

  useEffect(() => {
    fetch("/api/defaults", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDisabled(Array.isArray(d?.disabledBadges) ? d.disabledBadges : []))
      .catch(() => setDisabled([]))
  }, [])

  if (disabled === null) return null

  const set = async (key: string, show: boolean) => {
    const next = show ? disabled.filter((k) => k !== key) : [...disabled, key]
    const prev = disabled
    setDisabled(next)
    try {
      const res = await fetch("/api/defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabledBadges: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch {
      setDisabled(prev)
      toast.warning("Could not save to the server (is the data folder writable and are you unlocked with the PIN?)")
    }
  }

  return (
    <div className="pt-2 pb-1 space-y-2 border-t border-surface2/50">
      <div className="text-[11px] font-semibold text-zinc-200">Automatic top badges</div>
      {OPTIONS.map((o) => (
        <div key={o.key} className="flex items-center justify-between">
          <span className="text-muted">{o.label}</span>
          <Toggle value={!disabled.includes(o.key)} onChange={(v) => set(o.key, v)} label={o.label} />
        </div>
      ))}
    </div>
  )
}
