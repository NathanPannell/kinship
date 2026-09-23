import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ getApiUserId: vi.fn(), clearSessionCookie: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getApiUserId: mocks.getApiUserId, clearSessionCookie: mocks.clearSessionCookie }));
vi.mock("@/lib/db", () => ({ query: mocks.query }));

import { DELETE } from "./route";

const request = (origin: string | null, confirmation: string) => new NextRequest("https://kinship.example/api/account", {
  method: "DELETE",
  headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
  body: JSON.stringify({ confirmation }),
});

describe("account deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiUserId.mockResolvedValue("owner-1");
    mocks.query.mockResolvedValue([]);
  });

  it("requires a session and exact confirmation from the same origin", async () => {
    mocks.getApiUserId.mockResolvedValueOnce(null);
    expect((await DELETE(request("https://kinship.example", "DELETE MY ACCOUNT"))).status).toBe(401);
    expect((await DELETE(request("https://evil.example", "DELETE MY ACCOUNT"))).status).toBe(403);
    expect((await DELETE(request("https://kinship.example", "delete"))).status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("deletes only the signed-in user and clears the session", async () => {
    const response = await DELETE(request("https://kinship.example", "DELETE MY ACCOUNT"));
    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("DELETE FROM users WHERE id=$1", ["owner-1"]);
    expect(mocks.clearSessionCookie).toHaveBeenCalledWith(response);
  });
});
