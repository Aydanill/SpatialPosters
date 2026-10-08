import type { NextRequest } from "next/server"
import { getJellyfinConfig, getLibraryItems } from "@/lib/jellyfin"
import { guardJellyfinRequest, jellyfinErrorResponse } from "@/lib/jellyfin-route"
import { importLibrary } from "@/lib/jellyfin-import"
import { resolveRequestApiKey } from "@/lib/tmdb"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Saves every Jellyfin title (that has a TMDB id) into the SpatialPosters list. */
export async function POST(req: NextRequest): Promise<Response> {
  const blocked = await guardJellyfinRequest(req, { mutating: true, bucket: "mappings" })
  if (blocked) return blocked
  if (!getJellyfinConfig()) return Response.json({ error: "Jellyfin is not configured" }, { status: 400 })
  try {
    const items = await getLibraryItems(true)
    const result = await importLibrary(items, resolveRequestApiKey(req))
    return Response.json({ ok: true, ...result })
  } catch (e) {
    return jellyfinErrorResponse(e)
  }
}
