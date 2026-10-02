import { z } from "zod"

/**
 * SpatialPosters Full-Space Backup Schema (v2).
 *
 * v1 = raw mappings array or { mappings: [...] }.
 * v2 = { schemaVersion: 2, mappings?, aliases?, defaults?, presets?, local? }
 */

export const BACKUP_SCHEMA_VERSION = 2 as const

export const MAX_BACKUP_BODY_BYTES = 2_500_000
export const MAX_BACKUP_MAPPINGS = 1000
export const MAX_BACKUP_ALIASES = 1000
export const MAX_BACKUP_PRESETS = 100
export const MAX_BACKUP_DEFAULTS_BYTES = 256_000

export type BackupV2Sections = {
  mappings?: unknown
  aliases?: unknown
  defaults?: unknown
  presets?: unknown
}

export type ParsedBackup =
  | { kind: "v1"; mappings: unknown }
  | { kind: "v2"; sections: BackupV2Sections }
  | { kind: "local-only" }
  | { kind: "invalid"; error: string }

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * Classifies backup payload without strict validation (validation happens in route handlers).
 */
export function parseBackupBody(body: unknown): ParsedBackup {
  if (Array.isArray(body)) return { kind: "v1", mappings: body }
  if (!isPlainObject(body)) return { kind: "invalid", error: "mappings array required" }
  if (body.schemaVersion === BACKUP_SCHEMA_VERSION) {
    const sections: BackupV2Sections = {}
    let hasServerSection = false
    for (const key of ["mappings", "aliases", "defaults", "presets"] as const) {
      if (body[key] !== undefined) {
        sections[key] = body[key]
        hasServerSection = true
      }
    }
    if (!hasServerSection && body.local === undefined) return { kind: "invalid", error: "empty backup" }
    if (!hasServerSection) return { kind: "local-only" }
    return { kind: "v2", sections }
  }
  if (body.mappings !== undefined) return { kind: "v1", mappings: body.mappings }
  return { kind: "invalid", error: "mappings array required" }
}

const FORBIDDEN_DEFAULT_KEYS = new Set([
  "serverkeys",
  "hasinstancekeys",
  "tmdbkey",
  "mdblistapikey",
  "tvdbapikey",
  "apikey",
  "api_key",
])

const SECRET_KEY_RE = /(token|secret|password|passwd|pwd)/i

/**
 * Strips secrets from defaults payload before exporting or storing.
 */
export function stripBackupSecrets(defaults: unknown): Record<string, unknown> {
  if (!isPlainObject(defaults)) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(defaults)) {
    const kl = k.toLowerCase()
    if (FORBIDDEN_DEFAULT_KEYS.has(kl)) continue
    if (SECRET_KEY_RE.test(k)) continue
    out[k] = v
  }
  return out
}
