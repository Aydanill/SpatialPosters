import type { NextRequest } from "next/server"
import { getJellyfinConfig, getLibraryItems } from "@/lib/jellyfin"
import { guardJellyfinRequest, jellyfinErrorResponse } from "@/lib/jellyfin-route"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest): Promise<Response> {
  const blocked = await guardJellyfinRequest(req, { mutating: false })
  if (blocked) return blocked
  if (!getJellyfinConfig()) return Response.json({ configured: false, items: [] })
  try {
    const items = await getLibraryItems(req.nextUrl.searchParams.has("refresh"))
    return Response.json({ configured: true, items })
  } catch (e) {
    return jellyfinErrorResponse(e)
  }
}
