import type { NextRequest } from "next/server"
import { z } from "zod"
import { applyPoster, getJellyfinConfig, isValidItemId } from "@/lib/jellyfin"
import { guardJellyfinRequest, jellyfinErrorResponse } from "@/lib/jellyfin-route"
import { BodyTooLargeError, readJsonBody } from "@/lib/read-body"

export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 16_384

const bodySchema = z.object({
  id: z.string().refine(isValidItemId, "Invalid Jellyfin item id"),
  // The editor's current preview URL, so the poster sent is exactly what is on screen.
  posterUrl: z.string().max(8192).optional(),
})

/** Replaces the poster of ONE Jellyfin item. */
export async function POST(req: NextRequest): Promise<Response> {
  const blocked = await guardJellyfinRequest(req, { mutating: true, bucket: "poster" })
  if (blocked) return blocked
  if (!getJellyfinConfig()) return Response.json({ error: "Jellyfin is not configured" }, { status: 400 })

  let body: unknown
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES)
  } catch (e) {
    if (e instanceof BodyTooLargeError) return Response.json({ error: "Request body too large" }, { status: 413 })
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: "Expected { id, posterUrl? }" }, { status: 400 })

  try {
    const { name } = await applyPoster(parsed.data.id, parsed.data.posterUrl)
    return Response.json({ ok: true, name })
  } catch (e) {
    return jellyfinErrorResponse(e)
  }
}
