import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { query, getAgentUserId } = vi.hoisted(() => ({ query: vi.fn(), getAgentUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({ query }));
vi.mock("@/lib/auth", () => ({
  getAgentUserId,
  legacyOwnerUserId: "00000000-0000-4000-8000-000000000001",
}));

import { POST } from "./route";
import { legacyOwnerUserId } from "@/lib/auth";

const base = "https://example.com/api/agent/contacts";
const token = "a".repeat(32);
const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];

function request(body: unknown, authorized = true) {
  return new NextRequest(base, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorized ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getAgentUserId.mockImplementation(async (incoming: NextRequest) =>
    incoming.headers.get("authorization") === `Bearer ${token}` ? legacyOwnerUserId : null,
  );
  query.mockImplementation(async (_sql: string, values: unknown[]) => [{
    id: ids[query.mock.calls.length - 1],
    name: values[1],
    priority: values[9],
    cadence_days: values[10],
  }]);
});

describe("POST /api/agent/contacts", () => {
  it("creates a name-only contact with low priority and a 60-day cadence", async () => {
    const response = await POST(request({ name: "  Ada Lovelace  " }));

    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe(`/api/agent/contacts/${ids[0]}`);
    expect(await response.json()).toEqual({
      contact: { id: ids[0], name: "Ada Lovelace", priority: "low", cadence_days: 60 },
    });
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0]).toContain("INSERT INTO contacts");
    expect(query.mock.calls[0][1]).toEqual([
      legacyOwnerUserId, "Ada Lovelace", null, null, null, null, null, null, null, "low", 60, null,
    ]);
  });

  it("allows two contacts with the same name", async () => {
    const first = await POST(request({ name: "Alex Kim" }));
    const second = await POST(request({ name: "Alex Kim" }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((await first.json()).contact.id).toBe(ids[0]);
    expect((await second.json()).contact.id).toBe(ids[1]);
    expect(query.mock.calls.map((call) => call[1][1])).toEqual(["Alex Kim", "Alex Kim"]);
  });

  it("accepts optional details and explicit priority and cadence overrides", async () => {
    const response = await POST(request({
      name: "Grace Hopper",
      company: "Navy",
      role: "Engineer",
      linkedin_url: "https://www.linkedin.com/in/grace-hopper",
      photo_url: "https://example.com/grace.jpg",
      email: "grace@example.com",
      phone: "555-0100",
      location: "New York",
      priority: "high",
      cadence_days: 14,
      notes: "Met at an event",
    }));

    expect(response.status).toBe(201);
    expect(query.mock.calls[0][1]).toEqual([
      legacyOwnerUserId, "Grace Hopper", "Navy", "Engineer", "https://www.linkedin.com/in/grace-hopper",
      "https://example.com/grace.jpg", "grace@example.com", "555-0100", "New York",
      "high", 14, "Met at an event",
    ]);
  });

  it.each([{ }, { name: "   " }])("rejects a missing or blank name before inserting", async (body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid input");
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request before parsing or querying", async () => {
    const response = await POST(request({ name: "Ada Lovelace" }, false));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect(query).not.toHaveBeenCalled();
  });
});
