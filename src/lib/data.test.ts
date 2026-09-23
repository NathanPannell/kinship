import { beforeEach, describe, expect, it, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("./db", () => ({ query }));
import { createInteraction } from "./data";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const contactId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => query.mockReset());

describe("interaction creation", () => {
  it("writes the interaction and refreshes last contacted date", async () => {
    query.mockResolvedValueOnce([{ id: "interaction", contact_id: contactId, note: "Coffee", channel: "In person" }]).mockResolvedValueOnce([]);
    await createInteraction(userId, { contact_id: contactId, channel: "In person", note: "Coffee" });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain("c.owner_user_id=$1 AND c.id=$2");
    expect(query.mock.calls[0][1]).toEqual([userId, contactId, "In person", "Coffee", null]);
    expect(query.mock.calls[1][0]).toContain("MAX(occurred_at)");
    expect(query.mock.calls[1][0]).toContain("GREATEST(imported_last_contacted_at");
    expect(query.mock.calls[1][1]).toEqual([userId, contactId]);
  });

  it("does not create an interaction when the contact belongs to another account", async () => {
    query.mockResolvedValueOnce([]);

    await expect(createInteraction(userId, { contact_id: contactId, channel: "Email", note: "Hello" }))
      .rejects.toMatchObject({ code: "23503" });

    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0]).toContain("c.owner_user_id=$1 AND c.id=$2");
  });
});
