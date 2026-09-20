import { envWithFallback } from "@/lib/env-compat"
import { createLogger } from "@/lib/logger"
import { cacheGet, cacheSet } from "@/lib/cache"
import { hashKey } from "@/lib/poster-render-helpers"

const log = createLogger("imgbb-storage")

function getImgBBApiKey(): string | undefined {
  return process.env.IMGBB_API_KEY || envWithFallback("IMGBB_API_KEY")
}

export function isImgBBConfigured(): boolean {
  const key = getImgBBApiKey()
  return typeof key === "string" && key.trim().length > 0
}

const urlRegistryMap = new Map<string, string>()

export function getImgBBCachedUrl(cacheKey: string): string | null {
  const storeKey = `imgbb:url:${hashKey(cacheKey)}`
  const memoryUrl = urlRegistryMap.get(storeKey)
  if (memoryUrl) return memoryUrl

  const cached = cacheGet<string>(storeKey)
  if (cached) {
    urlRegistryMap.set(storeKey, cached)
    return cached
  }
  return null
}

export function setImgBBCachedUrl(cacheKey: string, url: string, ttlMs?: number): void {
  const storeKey = `imgbb:url:${hashKey(cacheKey)}`
  urlRegistryMap.set(storeKey, url)
  cacheSet(storeKey, url, ["imgbb"], ttlMs)
}

export interface ImgBBUploadResult {
  readonly url: string
  readonly displayUrl: string
  readonly deleteUrl?: string
}

export async function uploadToImgBB(
  buffer: Buffer,
  name?: string
): Promise<ImgBBUploadResult | null> {
  const apiKey = getImgBBApiKey()
  if (!apiKey) return null

  try {
    const base64Data = buffer.toString("base64")
    const formData = new URLSearchParams()
    formData.append("image", base64Data)
    if (name) {
      formData.append("name", name)
    }

    const endpoint = `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      log.error("ImgBB upload failed with non-200 status", { status: res.status, error: errText })
      return null
    }

    const json = await res.json()
    if (!json?.success || !json?.data?.url) {
      log.error("ImgBB response missing success/url field", { json })
      return null
    }

    const result: ImgBBUploadResult = {
      url: json.data.url,
      displayUrl: json.data.display_url || json.data.url,
      deleteUrl: json.data.delete_url,
    }

    log.info("Poster successfully uploaded to ImgBB", { url: result.displayUrl, sizeBytes: buffer.length })
    return result
  } catch (err) {
    log.error("Error uploading image to ImgBB", { err: err instanceof Error ? err.message : String(err) })
    return null
  }
}
