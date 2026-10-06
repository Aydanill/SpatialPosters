import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { JellyfinLibrary, editorHref } from "@/components/JellyfinLibrary"
import { JellyfinSendBar } from "@/components/JellyfinSendBar"

const A = "a".repeat(32)
const ITEMS = [
  { id: A, name: "The Matrix", year: 1999, type: "Movie", tmdbId: "603", hasPoster: true },
  { id: "b".repeat(32), name: "Breaking Bad", year: 2008, type: "Series", tmdbId: "1396", hasPoster: false },
  { id: "c".repeat(32), name: "Home Video", year: null, type: "Movie", tmdbId: null, hasPoster: false },
]

function mock(body: unknown, status = 200) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(body, { status }))
}

describe("JellyfinLibrary", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("lists titles linking to the editor with the jellyfin id", async () => {
    mock({ configured: true, items: ITEMS })
    render(<JellyfinLibrary />)
    const link = (await screen.findByText(/The Matrix/)).closest("a")!
    expect(link.getAttribute("href")).toBe(`/movie/603?jellyfin=${A}`)
    expect(screen.getByText(/Breaking Bad/).closest("a")!.getAttribute("href")).toMatch(/^\/tv\/1396\?jellyfin=/)
    expect(screen.getByText(/Home Video/).closest("a")).toBeNull()
    expect(editorHref(ITEMS[2] as never)).toBeNull()
  })

  it("filters by search", async () => {
    mock({ configured: true, items: ITEMS })
    const user = userEvent.setup()
    render(<JellyfinLibrary />)
    await screen.findByText(/The Matrix/)
    await user.type(screen.getByLabelText("Search title"), "break")
    expect(screen.queryByText(/The Matrix/)).not.toBeInTheDocument()
    expect(screen.getByText(/Breaking Bad/)).toBeInTheDocument()
  })

  it("explains the three failure states", async () => {
    mock({ error: "no" }, 401)
    const { unmount } = render(<JellyfinLibrary />)
    expect(await screen.findByText("Admin access needed")).toBeInTheDocument()
    unmount()
    vi.restoreAllMocks()
    mock({ configured: false, items: [] })
    const second = render(<JellyfinLibrary />)
    expect(await screen.findByText("Jellyfin isn't configured")).toBeInTheDocument()
    second.unmount()
    vi.restoreAllMocks()
    mock({ error: "Could not reach Jellyfin" }, 502)
    render(<JellyfinLibrary />)
    expect(await screen.findByText("Couldn't load Jellyfin")).toBeInTheDocument()
  })
})

describe("JellyfinSendBar", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("renders nothing without a valid ?jellyfin id", () => {
    window.history.pushState({}, "", "/movie/603")
    const { container } = render(<JellyfinSendBar previewUrl="/api/poster/movie/603" />)
    expect(container).toBeEmptyDOMElement()
    window.history.pushState({}, "", "/movie/603?jellyfin=../x")
    const again = render(<JellyfinSendBar previewUrl="/x" />)
    expect(again.container).toBeEmptyDOMElement()
  })

  it("posts the id and the current preview URL", async () => {
    window.history.pushState({}, "", `/movie/603?jellyfin=${A}`)
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true, name: "The Matrix" }))
    const user = userEvent.setup()
    render(<JellyfinSendBar previewUrl="/api/poster/movie/603?lang=en" />)
    await user.click(await screen.findByRole("button", { name: /Send to Jellyfin/ }))
    expect(await screen.findByText(/Sent to Jellyfin: The Matrix/)).toBeInTheDocument()
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe("/api/jellyfin/apply")
    expect(JSON.parse(String(init!.body))).toEqual({ id: A, posterUrl: "/api/poster/movie/603?lang=en" })
  })

  it("shows the server error", async () => {
    window.history.pushState({}, "", `/movie/603?jellyfin=${A}`)
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: "Could not reach Jellyfin" }, { status: 502 }))
    const user = userEvent.setup()
    render(<JellyfinSendBar previewUrl="/x" />)
    await user.click(await screen.findByRole("button", { name: /Send to Jellyfin/ }))
    expect(await screen.findByText(/Could not reach Jellyfin/)).toBeInTheDocument()
  })
})
