import { cacheGet, cacheSet } from "./cache"

export interface RedditPoster {
  id: string
  title: string
  url: string // The high-res image URL
  author: string
  upvotes: number
  flair: string | null
  permalink: string
}

const REDDIT_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

export async function fetchRedditPosters(tmdbId: string): Promise<RedditPoster[]> {
  const cacheKey = `reddit_posters_${tmdbId}`
  
  // 1. Check Cache
  const cached = await cacheGet<RedditPoster[]>(cacheKey)
  if (cached) return cached
  
  try {
    // 2. Query Reddit JSON API
    // Search for the TMDB ID in the SpatialPosters subreddit
    const query = encodeURIComponent(`[TMDB: ${tmdbId}]`)
    const res = await fetch(
      `https://www.reddit.com/r/SpatialPosters/search.json?q=${query}&restrict_sr=on&sort=top&raw_json=1`,
      {
        headers: {
          "User-Agent": "SpatialPosters/1.0 (Server-side image fetcher)"
        },
        // We use fetch cache bypass if needed, but depend on our own Redis/Memory cache
        cache: "no-store" 
      }
    )

    if (!res.ok) {
      console.error(`[Reddit API] Failed to fetch posters for TMDB ${tmdbId}: ${res.statusText}`)
      return []
    }

    const data = await res.json()
    const posts = data?.data?.children || []
    
    // 3. Parse and filter valid image posts
    const posters: RedditPoster[] = posts
      .map((child: any) => child.data)
      .filter((post: any) => {
        // Must be an image post (i.redd.it or has preview image)
        const isImage = post.url && (post.url.includes("i.redd.it") || post.url.includes("imgur.com") || post.post_hint === "image")
        return isImage && !post.is_video
      })
      .map((post: any) => {
        // Get the best high-res image URL available
        let imageUrl = post.url
        
        // Use preview source URL if available (reliable raw image)
        if (post.preview?.images?.[0]?.source?.url) {
          imageUrl = post.preview.images[0].source.url
        }

        return {
          id: post.id,
          title: post.title,
          url: imageUrl,
          author: post.author,
          upvotes: post.score,
          flair: post.link_flair_text || null,
          permalink: `https://www.reddit.com${post.permalink}`
        }
      })

    // 4. Set Cache
    await cacheSet(cacheKey, posters, ["reddit-posters"], REDDIT_CACHE_TTL)
    
    return posters
  } catch (error) {
    console.error(`[Reddit API] Exception fetching posters for TMDB ${tmdbId}:`, error)
    return [] // Fail gracefully, don't break the app!
  }
}
