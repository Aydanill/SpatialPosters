import { NextRequest } from "next/server"
import { importMappings } from "@/lib/store"
import { setServerDefaults } from "@/lib/server-defaults"
import { parseBackupBody, stripBackupSecrets, MAX_BACKUP_BODY_BYTES, MAX_BACKUP_MAPPINGS } from "@/lib/backup-schema"
import type { Mapping } from "@/lib/types"
import { mappingSchema } from "@/lib/validation"
import { checkAdminToken, isSameOrigin, adminAuthResponse, originMismatchResponse } from "@/lib/auth"
import { rateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit"
import { readJsonBody, BodyTooLargeError, InvalidJsonBodyError } from "@/lib/read-body"
import { cacheInvalidatePosterData } from "@/lib/cache"
import { bumpCatalogEpoch } from "@/lib/catalog-epoch"

export async function POST(req: NextRequest) {
  const rl = await rateLimit(rateLimitKey(req), "mappings")
  if (!rl.ok) return rateLimitResponse(rl.retAfter)
  if (!checkAdminToken(req)) return adminAuthResponse()
  if (!isSameOrigin(req)) return originMismatchResponse()

  const contentLength = Number(req.headers.get("content-length") || "0")
  if (Number.isFinite(contentLength) && contentLength > MAX_BACKUP_BODY_BYTES) {
    return Response.json({ error: "Request body too large" }, { status: 413 })
  }

  let body: unknown
  try {
    body = await readJsonBody(req, MAX_BACKUP_BODY_BYTES)
  } catch (e) {
    if (e instanceof BodyTooLargeError) return Response.json({ error: "Request body too large" }, { status: 413 })
    if (e instanceof InvalidJsonBodyError) return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    throw e
  }

  const parsedBackup = parseBackupBody(body)
  if (parsedBackup.kind === "invalid") {
    return Response.json({ error: parsedBackup.error }, { status: 400 })
  }

  if (parsedBackup.kind === "local-only") {
    return Response.json({ ok: true, count: 0, localOnly: true })
  }

  let rawMappings: unknown = undefined
  let serverDefaults: unknown = undefined

  if (parsedBackup.kind === "v1") {
    rawMappings = parsedBackup.mappings
  } else if (parsedBackup.kind === "v2") {
    rawMappings = parsedBackup.sections.mappings
    serverDefaults = parsedBackup.sections.defaults
  }

  const valid: Mapping[] = []
  const errors: Record<number, unknown> = {}

  if (Array.isArray(rawMappings)) {
    if (rawMappings.length > MAX_BACKUP_MAPPINGS) {
      return Response.json({ error: `Too many mappings (max ${MAX_BACKUP_MAPPINGS})` }, { status: 413 })
    }
    rawMappings.forEach((item: unknown, i: number) => {
      const parsed = mappingSchema.safeParse(item)
      if (parsed.success) {
        valid.push({
          ...parsed.data,
          updatedAt: (parsed.data as { updatedAt?: string }).updatedAt || new Date().toISOString(),
        } as Mapping)
      } else {
        errors[i] = parsed.error.flatten()
      }
    })
  }

  if (valid.length > 0) {
    await importMappings(valid)
  }

  if (serverDefaults && typeof serverDefaults === "object") {
    const cleanDefaults = stripBackupSecrets(serverDefaults)
    await setServerDefaults(cleanDefaults)
  }

  cacheInvalidatePosterData()
  await bumpCatalogEpoch()

  return Response.json({
    ok: true,
    count: valid.length,
    hasDefaults: !!serverDefaults,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  })
}
