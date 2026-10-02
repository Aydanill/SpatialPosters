import { NextRequest } from "next/server"
import { getAll } from "@/lib/store"
import { getServerDefaults } from "@/lib/server-defaults"
import { stripBackupSecrets } from "@/lib/backup-schema"
import { APP_VERSION } from "@/generated/app-version"
import { checkAdminToken, adminAuthResponse } from "@/lib/auth"
import { rateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit"

export async function GET(req: NextRequest) {
  const rl = await rateLimit(rateLimitKey(req), "mappings")
  if (!rl.ok) return rateLimitResponse(rl.retAfter)
  // Fail-open senza ADMIN_TOKEN (istanza pubblica HF Spaces); fail-closed con token.
  if (!checkAdminToken(req)) return adminAuthResponse()
  const mappings = await getAll()
  const defaults = stripBackupSecrets(getServerDefaults())
  return Response.json({
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    mappings,
    defaults,
  })
}

