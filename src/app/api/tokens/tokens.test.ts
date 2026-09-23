import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { requireApiSession, query } = vi.hoisted(() => ({ requireApiSession: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireApiSession }));
vi.mock("@/lib/db", () => ({ query }));
import { GET, POST } from "./route";
import { DELETE } from "./[id]/route";

const id = "11111111-1111-4111-8111-111111111111";
const base = "https://example.com";

beforeEach(() => {
  vi.clearAllMocks();
  requireApiSession.mockResolvedValue(null);
});

describe("API token management", () => {
  it("requires a session and excludes hashes from token listings", async () => {
    requireApiSession.mockResolvedValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    expect((await GET(new NextRequest(`${base}/api/tokens`))).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
    query.mockResolvedValueOnce([{ id, name: "My assistant", token_prefix: "kin_abc…", created_at: "2026-09-23T00:00:00Z", revoked_at: null }]);
    const response = await GET(new NextRequest(`${base}/api/tokens`));
    expect(response.status).toBe(200);
    expect(query.mock.calls[0][0]).not.toContain("token_hash");
    expect(await response.json()).toMatchObject({ tokens: [{ name: "My assistant" }] });
  });

  it("creates a one-time secret, stores only its hash, and revokes the record", async () => {
    query.mockResolvedValueOnce([{ id, name: "My assistant", token_prefix: "kin_abc…", created_at: "2026-09-23T00:00:00Z", revoked_at: null }]);
    const created = await POST(new NextRequest(`${base}/api/tokens`, { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: JSON.stringify({ name: "My assistant" }) }));
    expect(created.status).toBe(201);
    const payload = await created.json();
    expect(payload.token).toMatch(/^kin_[A-Za-z0-9_-]{43}$/);
    expect(query.mock.calls[0][1][1]).toMatch(/^[a-f0-9]{64}$/);
    expect(query.mock.calls[0][1][1]).not.toBe(payload.token);
    query.mockResolvedValueOnce([{ id }]);
    const revoked = await DELETE(new NextRequest(`${base}/api/tokens/${id}`, { method: "DELETE", headers: { origin: base } }), { params: Promise.resolve({ id }) });
    expect(revoked.status).toBe(200);
    expect(query.mock.calls[1][0]).toContain("revoked_at = now()");
  });

  it("rejects cross-origin token creation", async () => {
    const response = await POST(new NextRequest(`${base}/api/tokens`, { method: "POST", headers: { origin: "https://other.example", "content-type": "application/json" }, body: JSON.stringify({ name: "No" }) }));
    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
