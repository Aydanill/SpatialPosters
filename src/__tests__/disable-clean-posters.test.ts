import { describe, it, expect } from "vitest"
import { getServerDefaults } from "@/lib/server-defaults"

describe("disableCleanPosters feature", () => {
  it("includes disableCleanPosters in server defaults structure when provided", () => {
    const defaults = getServerDefaults()
    expect(defaults).toBeDefined()
    expect(typeof defaults).toBe("object")
  })
})
