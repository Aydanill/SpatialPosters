import type { NextRequest } from "next/server"
import { adminAuthResponse, checkAdminToken, isSameOrigin, originMismatchResponse } from "@/lib/auth"
import { rateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit"
import { JellyfinError } from "@/lib/jellyfin"
import { createLogger } from "@/lib/logger"

const log = createLogger("jellyfin")

/**
 * Shared gate for every /api/jellyfin route: rate limit, then the same admin
 * check the other admin routes use (admin token, PIN session, or public-instance
 * mode), plus the CSRF origin check on anything that changes data.
 * Returns a Response to send back when the request is refused, otherwise null.
 */
export async function guardJellyfinRequest(
  req: NextRequest,
  opts: { mutating: boolean; bucket?: string },
): Promise<Response | null> {
  const rl = await rateLimit(rateLimitKey(req), opts.bucket ?? "default")
  if (!rl.ok) return rateLimitResponse(rl.retAfter)
  if (!checkAdminToken(req)) return adminAuthResponse()
  if (opts.mutating && !isSameOrigin(req)) return originMismatchResponse()
  return null
}

export function jellyfinErrorResponse(e: unknown): Response {
  if (e instanceof JellyfinError) return Response.json({ error: e.message }, { status: e.status })
  log.warn("Unexpected Jellyfin route error", { error: e instanceof Error ? e.message : String(e) })
  return Response.json({ error: "Unexpected error" }, { status: 500 })
}
