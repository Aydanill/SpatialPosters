export interface MinimalStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface LocalBackupSection {
  lang?: string
  theme?: "light" | "dark"
  recentSearches?: string[]
  badgeDefaults?: string
  gradientPresets?: unknown[]
  catalogs?: Record<string, unknown>
  collections?: unknown
}

const RAW_CAPS: Record<string, number> = {
  badgeDefaults: 65_536,
  gradientPresets: 16_384,
  spatial_custom_catalogs: 65_536,
  pictorium_custom_catalogs: 65_536,
  spatial_disabled_catalogs: 8_192,
  pictorium_disabled_catalogs: 8_192,
  spatial_catalog_order: 16_384,
  pictorium_catalog_order: 16_384,
  spatial_catalog_renames: 16_384,
  pictorium_catalog_renames: 16_384,
  spatial_collections: 65_536,
  pictorium_collections: 65_536,
  recent_searches: 8_192,
}

const SUPPORTED_LANGS = new Set(["en", "it", "fr", "de", "es", "ja", "ko", "pt", "he"])

function isSupportedUiLang(lang: string): boolean {
  return SUPPORTED_LANGS.has(lang.toLowerCase())
}

function readRaw(storage: MinimalStorage, key: string): string | null {
  try {
    const raw = storage.getItem(key)
    if (!raw || raw.length > (RAW_CAPS[key] ?? 65_536)) return null
    return raw
  } catch {
    return null
  }
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(raw)
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Safely collects local user preferences for backup.
 */
export function collectLocalBackup(storage: MinimalStorage, uuid: string | null): LocalBackupSection {
  const out: LocalBackupSection = {}
  try {
    const lang = readRaw(storage, "preferred_lang")
    if (lang && isSupportedUiLang(lang.trim())) out.lang = lang.trim().toLowerCase()
  } catch {}
  try {
    const theme = readRaw(storage, "spatialposters_theme") || readRaw(storage, "pictorium_theme")
    if (theme === "light" || theme === "dark") out.theme = theme
  } catch {}
  try {
    const raw = readRaw(storage, "recent_searches")
    if (raw) {
      const arr: unknown = JSON.parse(raw)
      if (Array.isArray(arr)) {
        const clean = arr.filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 200)).slice(0, 20)
        if (clean.length > 0) out.recentSearches = clean
      }
    }
  } catch {}
  try {
    const raw = readRaw(storage, uuid ? `badgeDefaults:${uuid}` : "badgeDefaults")
    if (raw && parseJsonObject(raw)) out.badgeDefaults = raw
  } catch {}
  try {
    const catalogs: Record<string, unknown> = {}
    const defs: Array<[string, string, string, (v: unknown) => boolean]> = [
      ["custom", "spatial_custom_catalogs", "pictorium_custom_catalogs", Array.isArray],
      ["disabled", "spatial_disabled_catalogs", "pictorium_disabled_catalogs", Array.isArray],
      ["order", "spatial_catalog_order", "pictorium_catalog_order", Array.isArray],
      ["renames", "spatial_catalog_renames", "pictorium_catalog_renames", (v) => typeof v === "object" && v !== null && !Array.isArray(v)],
    ]
    for (const [name, k1, k2, ok] of defs) {
      const raw = readRaw(storage, k1) || readRaw(storage, k2)
      if (!raw) continue
      try {
        const v: unknown = JSON.parse(raw)
        if (ok(v)) catalogs[name] = v
      } catch {}
    }
    if (Object.keys(catalogs).length > 0) out.catalogs = catalogs
  } catch {}
  try {
    const raw = readRaw(storage, "spatial_collections") || readRaw(storage, "pictorium_collections")
    if (raw) {
      const v: unknown = JSON.parse(raw)
      if (Array.isArray(v)) out.collections = v
    }
  } catch {}
  return out
}

export interface ApplyLocalResult {
  applied: string[]
  skipped: string[]
}

/**
 * Restores the `local` section into browser storage safely.
 */
export function applyLocalBackup(
  storage: MinimalStorage,
  uuid: string | null,
  local: unknown
): ApplyLocalResult {
  const applied: string[] = []
  const skipped: string[] = []
  if (typeof local !== "object" || local === null || Array.isArray(local)) return { applied, skipped }
  const src = local as Record<string, unknown>
  const write = (name: string, key: string, value: string, cap: number) => {
    try {
      if (value.length > cap) {
        skipped.push(name)
        return
      }
      storage.setItem(key, value)
      applied.push(name)
    } catch {
      skipped.push(name)
    }
  }
  if (typeof src.lang === "string" && isSupportedUiLang(src.lang.trim())) {
    write("lang", "preferred_lang", src.lang.trim().toLowerCase(), 8)
  } else if (src.lang !== undefined) skipped.push("lang")
  if (src.theme === "light" || src.theme === "dark") {
    write("theme", "spatialposters_theme", src.theme, 8)
  } else if (src.theme !== undefined) skipped.push("theme")
  if (Array.isArray(src.recentSearches)) {
    const clean = src.recentSearches
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.slice(0, 200))
      .slice(0, 20)
    if (clean.length > 0) write("recentSearches", "recent_searches", JSON.stringify(clean), RAW_CAPS.recent_searches)
    else skipped.push("recentSearches")
  } else if (src.recentSearches !== undefined) skipped.push("recentSearches")
  if (typeof src.badgeDefaults === "string") {
    if (parseJsonObject(src.badgeDefaults)) {
      write("badgeDefaults", uuid ? `badgeDefaults:${uuid}` : "badgeDefaults", src.badgeDefaults, RAW_CAPS.badgeDefaults)
    } else skipped.push("badgeDefaults")
  } else if (src.badgeDefaults !== undefined) skipped.push("badgeDefaults")
  if (typeof src.catalogs === "object" && src.catalogs !== null && !Array.isArray(src.catalogs)) {
    const cats = src.catalogs as Record<string, unknown>
    const defs: Array<[string, string, (v: unknown) => boolean]> = [
      ["custom", "spatial_custom_catalogs", Array.isArray],
      ["disabled", "spatial_disabled_catalogs", Array.isArray],
      ["order", "spatial_catalog_order", Array.isArray],
      ["renames", "spatial_catalog_renames", (v) => typeof v === "object" && v !== null && !Array.isArray(v)],
    ]
    for (const [name, key, ok] of defs) {
      const v = cats[name]
      if (v === undefined) continue
      if (ok(v)) write(`catalogs.${name}`, key, JSON.stringify(v), RAW_CAPS[key] ?? 65_536)
      else skipped.push(`catalogs.${name}`)
    }
  } else if (src.catalogs !== undefined) skipped.push("catalogs")
  if (Array.isArray(src.collections)) {
    if (src.collections.length > 0) {
      write("collections", "spatial_collections", JSON.stringify(src.collections), RAW_CAPS.spatial_collections ?? 65_536)
    } else skipped.push("collections")
  } else if (src.collections !== undefined) skipped.push("collections")
  return { applied, skipped }
}
