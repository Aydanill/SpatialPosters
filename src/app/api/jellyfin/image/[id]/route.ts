import type { NextRequest } from "next/server"
import { fetchCurrentPoster, getJellyfinConfig, isValidItemId } from "@/lib/jellyfin"
import { guardJellyfinRequest } from "@/lib/jellyfin-route"

export const dynamic = "force-dynamic"

/** Proxies the poster Jellyfin currently shows, so the browser never needs the Jellyfin API key. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const blocked = await guardJellyfinRequest(req, { mutating: false, bucket: "poster" })
  if (blocked) return blocked
  const { id } = await params
  if (!isValidItemId(id)) return new Response("Bad id", { status: 400 })
  if (!getJellyfinConfig()) return new Response("Jellyfin is not configured", { status: 404 })
  try {
    const image = await fetchCurrentPoster(id)
    if (!image) return new Response("No poster", { status: 404 })
    return new Response(image.body, {
      headers: { "Content-Type": image.contentType, "Cache-Control": "private, max-age=300" },
    })
  } catch {
    return new Response("Jellyfin unavailable", { status: 502 })
  }
}
