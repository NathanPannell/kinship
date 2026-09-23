import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { GET as callback } from "./callback/route";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://kinship.example/api/auth/google/callback");
});

describe("Google OAuth authorization", () => {
  it("uses PKCE, state, nonce, minimum scopes, and the fixed registered callback", async () => {
    const response = await GET();
    const destination = new URL(response.headers.get("location")!);
    expect(destination.origin).toBe("https://accounts.google.com");
    expect(destination.searchParams.get("redirect_uri")).toBe("https://kinship.example/api/auth/google/callback");
    expect(destination.searchParams.get("scope")).toBe("openid email profile");
    expect(destination.searchParams.get("code_challenge_method")).toBe("S256");
    expect(destination.searchParams.get("code_challenge")).toBeTruthy();
    expect(destination.searchParams.get("state")).toBeTruthy();
    expect(destination.searchParams.get("nonce")).toBeTruthy();
    expect(response.headers.getSetCookie().join("\n")).toContain("HttpOnly");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("fails closed when the exact callback is not configured", async () => {
    vi.stubEnv("GOOGLE_REDIRECT_URI", "");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
  });

  it("rejects a mismatched state before exchanging a code", async () => {
    const response = await callback(
      new NextRequest("https://untrusted-host.example/api/auth/google/callback?code=a-code&state=returned", {
        headers: {
          cookie:
            "networking_crm_google_state=saved; networking_crm_google_verifier=verifier; networking_crm_google_nonce=nonce",
        },
      }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://kinship.example/login?error=invalid_oauth_response");
    expect(response.headers.getSetCookie().join("\n")).toContain("networking_crm_google_state=");
  });
});
