import { describe, expect, it, vi } from "vitest";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("./db", () => ({ query }));
import { createInteraction } from "./data";

describe("interaction creation", () => {
  it("writes the interaction and refreshes last contacted date", async () => {
    query.mockResolvedValueOnce([{ id: "interaction", contact_id: "11111111-1111-4111-8111-111111111111", note: "Coffee", channel: "In person" }]).mockResolvedValueOnce([]);
    await createInteraction({ contact_id: "11111111-1111-4111-8111-111111111111", channel: "In person", note: "Coffee" });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain("MAX(occurred_at)");
  });
});
