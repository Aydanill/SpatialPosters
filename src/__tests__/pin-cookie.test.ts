// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest"
import { buildSessionCookie, isSecureRequest } from "@/lib/pin-auth"

describe("session cookie Secure flag", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("is not Secure on a plain-http connection, even in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    const req = new Request("http://192.168.1.10:8080/api/auth/pin")
    expect(buildSessionCookie("t", { secure: isSecureRequest(req) })).not.toMatch(/Secure/)
  })

  it("is Secure on https, including behind a TLS-terminating proxy", () => {
    expect(isSecureRequest(new Request("https://posters.example/api/auth/pin"))).toBe(true)
    const proxied = new Request("http://spatialposters:8080/api/auth/pin", { headers: { "x-forwarded-proto": "https" } })
    expect(isSecureRequest(proxied)).toBe(true)
    expect(buildSessionCookie("t", { secure: true })).toMatch(/; Secure$/)
  })

  it("x-forwarded-proto wins over the internal URL scheme", () => {
    const req = new Request("https://internal/api/auth/pin", { headers: { "x-forwarded-proto": "http" } })
    expect(isSecureRequest(req)).toBe(false)
  })

  it("keeps the old default when no option is given", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(buildSessionCookie("t")).toMatch(/; Secure$/)
    vi.stubEnv("NODE_ENV", "development")
    expect(buildSessionCookie("t")).not.toMatch(/Secure/)
  })

  it("always keeps HttpOnly and SameSite", () => {
    const c = buildSessionCookie("t", { secure: false })
    expect(c).toMatch(/HttpOnly/)
    expect(c).toMatch(/SameSite=Lax/)
  })
})
