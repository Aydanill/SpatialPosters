"use client"

import React, { useEffect, useState } from "react"
import { Clapperboard } from "lucide-react"

const ID_RE = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i

/**
 * Shown in the editor only when it was opened from the Jellyfin page
 * (?jellyfin=<item id>). Sends the poster currently on screen to that item.
 */
export function JellyfinSendBar({ previewUrl }: { previewUrl: string }) {
  const [itemId, setItemId] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("jellyfin")
    setItemId(id && ID_RE.test(id) ? id : null)
  }, [])

  if (!itemId) return null

  const send = async () => {
    setStatus("sending")
    setMessage("")
    try {
      const res = await fetch("/api/jellyfin/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, posterUrl: previewUrl || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setStatus("done")
      setMessage(`Sent to Jellyfin${data.name ? `: ${data.name}` : ""}`)
    } catch (e) {
      setStatus("error")
      setMessage(e instanceof Error ? e.message : "Failed")
    }
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/95 px-4 py-3 shadow-xl">
      {message && (
        <span role="status" className={`text-xs ${status === "error" ? "text-red-400" : "text-emerald-400"}`}>
          {message}
        </span>
      )}
      <button
        onClick={send}
        disabled={status === "sending"}
        className="inline-flex items-center gap-2 text-sm font-semibold rounded-xl bg-accent-orange/20 border border-accent-orange/40 px-3 py-2 disabled:opacity-50"
      >
        <Clapperboard className="w-4 h-4" />
        {status === "sending" ? "Sending…" : "Send to Jellyfin"}
      </button>
    </div>
  )
}
