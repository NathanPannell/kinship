import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db", () => ({ query }));

import {
  getAgentUserId,
  getApiUserId,
  legacyOwnerUserId,
  makeSession,
  resolveGoogleUser,
  validSession,
} from "./auth";

const userId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("SESSION_SECRET", "s".repeat(48));
  query.mockResolvedValue([]);
});

describe("browser sessions", () => {
  it("accepts a versioned internal user session only while the user exists", async () => {
    const token = await makeSession(userId);
    query.mockResolvedValueOnce([{ id: userId }]).mockResolvedValueOnce([]);
    expect(await validSession(token)).toBe(true);
    expect(await validSession(token)).toBe(false);
  });

  it("rejects legacy identity sessions even when correctly signed", async () => {
    const secret = new TextEncoder().encode("s".repeat(48));
    const token = await new SignJWT({ identity: "password:legacy" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);
    expect(await validSession(token)).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it("reads the user id from an authenticated API request", async () => {
    const token = await makeSession(userId);
    query.mockResolvedValueOnce([{ id: userId }]);
    const request = new NextRequest("https://example.com/api/contacts", {
      headers: { cookie: `networking_crm_session=${token}` },
    });
    expect(await getApiUserId(request)).toBe(userId);
  });
});

describe("Google identity ownership", () => {
  it("atomically claims the legacy owner for the configured verified email", async () => {
    vi.stubEnv("LEGACY_OWNER_EMAIL", "Owner@gmail.com");
    query.mockResolvedValueOnce([{ id: legacyOwnerUserId }]);
    await expect(resolveGoogleUser({ sub: "google-123", email: "owner@gmail.com", name: "Owner" })).resolves.toBe(legacyOwnerUserId);
    expect(query.mock.calls[0][0]).toContain("users.google_sub IS NULL OR users.google_sub = EXCLUDED.google_sub");
    expect(query.mock.calls[0][1]).toEqual(["google-123", "owner@gmail.com", "Owner", null, legacyOwnerUserId]);
  });

  it("refuses to replace a legacy owner's existing Google identity", async () => {
    vi.stubEnv("LEGACY_OWNER_EMAIL", "owner@gmail.com");
    query.mockResolvedValueOnce([]);
    await expect(resolveGoogleUser({ sub: "attacker-sub", email: "owner@gmail.com", name: "Owner" })).rejects.toThrow(
      "already linked",
    );
  });

  it("does not use a third-party email claim without a matching Workspace domain", async () => {
    vi.stubEnv("LEGACY_OWNER_EMAIL", "owner@example.com");
    await expect(resolveGoogleUser({ sub: "google-unsafe", email: "owner@example.com", name: "Owner" })).rejects.toThrow(
      "not authoritative",
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("upserts all other users by stable Google subject", async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: userId }]);
    await expect(resolveGoogleUser({ sub: "google-456", email: "new@example.com", name: "New User" })).resolves.toBe(userId);
    expect(query.mock.calls[1][0]).toContain("ON CONFLICT (google_sub)");
  });

  it("gates new accounts until the migrated owner has claimed existing data", async () => {
    query.mockResolvedValueOnce([{ id: legacyOwnerUserId }]);
    await expect(resolveGoogleUser({ sub: "google-789", email: "other@example.com", name: "Other User" })).rejects.toThrow(
      "legacy owner must complete Google sign-in",
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("agent API authentication", () => {
  it("does not accept the old global agent token", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "x".repeat(40));
    const request = new NextRequest("https://example.com/api/agent/suggestions", {
      headers: { Authorization: `Bearer ${"x".repeat(40)}` },
    });
    expect(await getAgentUserId(request)).toBeNull();
  });

  it("returns the owner of an active named token", async () => {
    const token = `kin_${"a".repeat(43)}`;
    query.mockResolvedValueOnce([{ owner_user_id: userId }]);
    const request = new NextRequest("https://example.com/api/agent/suggestions", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(await getAgentUserId(request)).toBe(userId);
    expect(query.mock.calls[0][0]).toContain("revoked_at IS NULL");
    expect(query.mock.calls[0][1][0]).not.toBe(token);
  });
});
