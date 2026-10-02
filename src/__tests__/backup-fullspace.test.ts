import { describe, it, expect } from "vitest"
import { parseBackupBody, stripBackupSecrets } from "@/lib/backup-schema"
import { collectLocalBackup, applyLocalBackup, type MinimalStorage } from "@/lib/backup-local"

describe("backup-schema & backup-local", () => {
  it("parses v1 array backup", () => {
    const raw = [{ mediaType: "movie", tmdbId: "123" }]
    const parsed = parseBackupBody(raw)
    expect(parsed.kind).toBe("v1")
  })

  it("parses v2 full space backup", () => {
    const payload = {
      schemaVersion: 2,
      mappings: [{ mediaType: "movie", tmdbId: "123" }],
      defaults: { badgeStyle: "vetro", tmdbKey: "secret123" },
    }
    const parsed = parseBackupBody(payload)
    expect(parsed.kind).toBe("v2")
  })

  it("strips secret keys from defaults", () => {
    const defaults = {
      badgeStyle: "vetro",
      tmdbKey: "secret_key",
      admin_password: "1234password",
      region: "US",
    }
    const clean = stripBackupSecrets(defaults)
    expect(clean).toEqual({
      badgeStyle: "vetro",
      region: "US",
    })
  })

  it("collects and applies local storage backup", () => {
    const store = new Map<string, string>()
    const storage: MinimalStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
    }

    storage.setItem("preferred_lang", "en")
    storage.setItem("spatialposters_theme", "dark")
    storage.setItem("recent_searches", JSON.stringify(["Inception", "Interstellar"]))

    const collected = collectLocalBackup(storage, null)
    expect(collected.lang).toBe("en")
    expect(collected.theme).toBe("dark")
    expect(collected.recentSearches).toEqual(["Inception", "Interstellar"])

    const targetStore = new Map<string, string>()
    const targetStorage: MinimalStorage = {
      getItem: (k) => targetStore.get(k) ?? null,
      setItem: (k, v) => targetStore.set(k, v),
    }

    const result = applyLocalBackup(targetStorage, null, collected)
    expect(result.applied).toContain("lang")
    expect(result.applied).toContain("theme")
    expect(targetStore.get("preferred_lang")).toBe("en")
    expect(targetStore.get("spatialposters_theme")).toBe("dark")
  })
})
