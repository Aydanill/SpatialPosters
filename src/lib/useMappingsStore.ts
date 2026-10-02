"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import type { Mapping } from "./types"
import { http } from "./http"
import { t } from "./i18n"
import { collectLocalBackup, applyLocalBackup } from "./backup-local"

export function useMappingsStore() {
  const [mappings, setMappings] = useState<Mapping[]>([])

  const mappingsMap = useMemo(() => {
    const map = new Map<string, Mapping>()
    for (const m of mappings) {
      map.set(`${m.mediaType}:${m.tmdbId}`, m)
    }
    return map
  }, [mappings])

  const loadMappings = useCallback(async () => {
    try {
      const res = await fetch("/api/mappings")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMappings(Array.isArray(data.mappings) ? data.mappings : [])
    } catch (e) {
      console.error("[spatialposters] Failed to load mappings:", e)
    }
  }, [])

  useEffect(() => {
    loadMappings()
  }, [loadMappings])

  const removeMapping = useCallback(async (m: Mapping) => {
    await http(`/api/mappings/${m.mediaType}:${m.tmdbId}`, { method: "DELETE" })
    setMappings((prev) => prev.filter((x) => !(x.tmdbId === m.tmdbId && x.mediaType === m.mediaType)))
    import("sonner").then(({ toast }) => toast(t("ui.mappingRemoved")))
  }, [])

  const exportData = useCallback(async () => {
    try {
      const serverData = await http<Record<string, unknown>>("/api/mappings/export")
      const localData = typeof window !== "undefined" && window.localStorage ? collectLocalBackup(localStorage, null) : {}
      const fullPayload = {
        ...serverData,
        schemaVersion: 2,
        local: localData,
      }
      const blob = new Blob([JSON.stringify(fullPayload, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `spatialposters-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      import("sonner").then(({ toast }) => toast.success(t("ui.saved") || "Backup exported successfully!"))
    } catch (e) {
      console.error("[spatialposters] Export failed:", e)
      import("sonner").then(({ toast }) => toast.error(t("ui.exportError")))
    }
  }, [])

  const importData = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text)
        const res = await fetch("/api/mappings/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const errBody = await res.json().catch(() => null)
          const hasDetails = errBody && typeof errBody.details === "object" && errBody.details !== null
          const detailsMsg = hasDetails ? Object.values(errBody.details).flat().join("; ") : ""
          const msg = errBody?.error || detailsMsg || t("ui.importError")
          import("sonner").then(({ toast }) => toast.error(msg))
          return
        }
        if (data.local && typeof window !== "undefined" && window.localStorage) {
          applyLocalBackup(localStorage, null, data.local)
        }
        await loadMappings()
        const result = await res.json()
        const importedCount = result.count ?? (Array.isArray(data.mappings) ? data.mappings.length : 0)
        import("sonner").then(({ toast }) => toast.success(t("ui.importSuccess", { count: importedCount })))
      } catch (e) {
        const msg = e instanceof SyntaxError ? t("ui.importError") : (e as Error).message
        import("sonner").then(({ toast }) => toast.error(msg))
      }
    }
    input.click()
  }, [loadMappings])

  return { mappings, setMappings, mappingsMap, loadMappings, removeMapping, exportData, importData }
}
