import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { requireAgentToken } from "./auth";

describe("agent API authentication", () => {
  it("rejects absent and invalid tokens", () => {
    vi.stubEnv("AGENT_API_TOKEN", "x".repeat(40));
    expect(requireAgentToken(new NextRequest("https://example.com/api/agent/suggestions"))?.status).toBe(401);
    expect(requireAgentToken(new NextRequest("https://example.com/api/agent/suggestions", { headers: { Authorization: "Bearer wrong" } }))?.status).toBe(401);
  });
  it("accepts the configured token", () => {
    vi.stubEnv("AGENT_API_TOKEN", "x".repeat(40));
    expect(requireAgentToken(new NextRequest("https://example.com/api/agent/suggestions", { headers: { Authorization: `Bearer ${"x".repeat(40)}` } }))).toBeNull();
  });
});
