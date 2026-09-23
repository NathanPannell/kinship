import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("./db", () => ({ query }));

import { deleteAllContacts, deleteContactsBulk, updateContactsBulk } from "./data";
import { bulkContactDeleteSchema, bulkContactUpdateSchema, deleteAllContactsSchema } from "./validation";

const idA = "11111111-1111-4111-8111-111111111111";
const idB = "22222222-2222-4222-8222-222222222222";
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => query.mockReset());

describe("bulk contact changes", () => {
  it("requires distinct valid contact IDs and at least one valid update", () => {
    for (const input of [
      { ids: [], updates: { priority: "high" } },
      { ids: [idA, idA], updates: { priority: "high" } },
      { ids: ["bad"], updates: { priority: "high" } },
      { ids: [idA], updates: {} },
      { ids: [idA], updates: { cadence_days: 0 } },
      { ids: [idA], updates: { priority: "medium" } },
    ]) expect(() => bulkContactUpdateSchema.parse(input)).toThrow(ZodError);
    expect(() => bulkContactDeleteSchema.parse({ ids: [] })).toThrow(ZodError);
    expect(() => deleteAllContactsSchema.parse({ confirmation: "delete" })).toThrow(ZodError);
  });

  it("updates only selected contacts in one database statement", async () => {
    query.mockResolvedValueOnce([{ count: 2 }]);
    expect(await updateContactsBulk(userId, { ids: [idA, idB], updates: { priority: "high", cadence_days: 14 } })).toBe(2);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("WHERE owner_user_id=$1 AND id=ANY($2::uuid[])");
    expect(query.mock.calls[0][1]).toEqual([userId, [idA, idB], "high", 14]);
  });

  it("deletes selected contacts in one statement and relies on cascading interactions", async () => {
    query.mockResolvedValueOnce([{ count: 1 }]);
    expect(await deleteContactsBulk(userId, { ids: [idA] })).toBe(1);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("DELETE FROM contacts WHERE owner_user_id=$1 AND id=ANY($2::uuid[])");
    expect(query.mock.calls[0][1]).toEqual([userId, [idA]]);
  });

  it("deletes all contacts in one statement", async () => {
    query.mockResolvedValueOnce([{ count: 3 }]);
    expect(await deleteAllContacts(userId)).toBe(3);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("DELETE FROM contacts WHERE owner_user_id=$1 RETURNING id");
    expect(query.mock.calls[0][1]).toEqual([userId]);
  });
});
