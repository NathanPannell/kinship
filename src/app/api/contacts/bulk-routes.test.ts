import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getApiUserId, deleteAllContacts, deleteContactsBulk, updateContactsBulk } = vi.hoisted(() => ({
  getApiUserId: vi.fn(), deleteAllContacts: vi.fn(), deleteContactsBulk: vi.fn(), updateContactsBulk: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getApiUserId }));
vi.mock("@/lib/data", () => ({ deleteAllContacts, deleteContactsBulk, updateContactsBulk }));

import { DELETE as deleteEveryone } from "./route";
import { DELETE as deleteSelected, POST as updateSelected } from "./bulk/route";

const id = "11111111-1111-4111-8111-111111111111";
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function request(path: string, method: string, body: unknown) {
  return new NextRequest(`https://example.com${path}`, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  getApiUserId.mockResolvedValue(userId);
});

describe("authenticated bulk contact routes", () => {
  it("rejects unauthenticated destructive requests before reaching the database", async () => {
    getApiUserId.mockResolvedValue(null);
    expect((await deleteEveryone(request("/api/contacts", "DELETE", { confirmation: "DELETE_ALL_CONTACTS" }))).status).toBe(401);
    expect((await deleteSelected(request("/api/contacts/bulk", "DELETE", { ids: [id] }))).status).toBe(401);
    expect(deleteAllContacts).not.toHaveBeenCalled();
    expect(deleteContactsBulk).not.toHaveBeenCalled();
  });

  it("requires an exact confirmation before deleting everyone", async () => {
    expect((await deleteEveryone(request("/api/contacts", "DELETE", { confirmation: "DELETE" }))).status).toBe(400);
    expect(deleteAllContacts).not.toHaveBeenCalled();
    deleteAllContacts.mockResolvedValue(8);
    const response = await deleteEveryone(request("/api/contacts", "DELETE", { confirmation: "DELETE_ALL_CONTACTS" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 8 });
    expect(deleteAllContacts).toHaveBeenCalledWith(userId);
  });

  it("forwards selected updates and deletions and reports affected rows", async () => {
    updateContactsBulk.mockResolvedValue(1);
    deleteContactsBulk.mockResolvedValue(1);
    const update = await updateSelected(request("/api/contacts/bulk", "POST", { ids: [id], updates: { priority: "low" } }));
    expect(await update.json()).toEqual({ updated: 1 });
    expect(updateContactsBulk).toHaveBeenCalledWith(userId, { ids: [id], updates: { priority: "low" } });
    const removal = await deleteSelected(request("/api/contacts/bulk", "DELETE", { ids: [id] }));
    expect(await removal.json()).toEqual({ deleted: 1 });
    expect(deleteContactsBulk).toHaveBeenCalledWith(userId, { ids: [id] });
  });
});
