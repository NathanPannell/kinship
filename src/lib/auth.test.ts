import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db", () => ({ query }));
import { requireAgentToken } from "./auth";

beforeEach(() => { vi.clearAllMocks(); query.mockResolvedValue([]); });

describe("agent API authentication", () => {
  it("rejects absent and invalid tokens", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "x".repeat(40));
    expect((await requireAgentToken(new NextRequest("https://example.com/api/agent/suggestions")))?.status).toBe(401);
    expect((await requireAgentToken(new NextRequest("https://example.com/api/agent/suggestions", { headers: { Authorization: "Bearer wrong" } })))?.status).toBe(401);
  });
  it("accepts the configured legacy token", async () => {
    vi.stubEnv("AGENT_API_TOKEN", "x".repeat(40));
    expect(await requireAgentToken(new NextRequest("https://example.com/api/agent/suggestions", { headers: { Authorization: `Bearer ${"x".repeat(40)}` } }))).toBeNull();
  });
  it("accepts only active stored tokens", async () => {
    const token = `kin_${"a".repeat(43)}`;
    const request = new NextRequest("https://example.com/api/agent/suggestions", { headers: { Authorization: `Bearer ${token}` } });
    query.mockResolvedValueOnce([{ id: "active" }]).mockResolvedValueOnce([]);
    expect(await requireAgentToken(request)).toBeNull();
    expect((await requireAgentToken(request))?.status).toBe(401);
    expect(query.mock.calls[0][0]).toContain("revoked_at IS NULL");
    expect(query.mock.calls[0][1][0]).not.toBe(token);
  });
});
