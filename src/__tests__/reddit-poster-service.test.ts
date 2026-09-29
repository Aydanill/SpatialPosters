import { describe, it, expect, vi } from "vitest"
import { fetchRedditPosters } from "@/lib/reddit-poster-service"

// We mock the fetch API to not actually hit Reddit during automated tests
// but you can comment out the mock to test it for real!
describe("Reddit Poster Service", () => {
  it("should return an empty array if fetch fails gracefully", async () => {
    // Mock fetch to fail
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      statusText: "Internal Server Error"
    })
    
    const posters = await fetchRedditPosters("550")
    expect(posters).toEqual([]) // Graceful fallback
  })

  it("should parse Reddit JSON correctly", async () => {
    const mockRedditResponse = {
      data: {
        children: [
          {
            data: {
              id: "test1",
              title: "Fight Club (1999) [TMDB: 550]",
              url: "https://i.redd.it/test.jpg",
              author: "testuser",
              score: 150,
              link_flair_text: "Clean Poster",
              permalink: "/r/SpatialPosters/comments/test1/",
              post_hint: "image"
            }
          },
          {
             data: {
              id: "test2", // Should be ignored (no image)
              title: "Just a text post [TMDB: 550]",
              url: "https://reddit.com",
              author: "testuser2",
              score: 10,
              link_flair_text: null,
              permalink: "/r/SpatialPosters/comments/test2/"
             }
          }
        ]
      }
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockRedditResponse
    })

    const posters = await fetchRedditPosters("550")
    
    // Should only return the valid image post
    expect(posters.length).toBe(1)
    expect(posters[0].id).toBe("test1")
    expect(posters[0].url).toBe("https://i.redd.it/test.jpg")
    expect(posters[0].flair).toBe("Clean Poster")
    expect(posters[0].upvotes).toBe(150)
  })
})
