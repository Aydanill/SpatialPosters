import { NextResponse } from "next/server"
import { fetchRedditPosters } from "@/lib/reddit-poster-service"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tmdbId = searchParams.get("tmdbId")
    
    if (!tmdbId) {
      return NextResponse.json(
        { error: "Missing tmdbId parameter" },
        { status: 400 }
      )
    }

    const posters = await fetchRedditPosters(tmdbId)

    return NextResponse.json({
      success: true,
      count: posters.length,
      posters
    })
  } catch (error) {
    console.error("[Reddit API Route Error]:", error)
    return NextResponse.json(
      { error: "Internal Server Error", posters: [] },
      { status: 500 }
    )
  }
}
