import { describe, expect, it } from "vitest";
import { decorateContact, rankSuggestions } from "./recommendations";
import type { Contact } from "./types";

const now = new Date("2026-09-22T12:00:00Z");
function contact(name: string, priority: Contact["priority"], cadence: number, days: number | null): Contact {
  return { id: name, name, company: null, role: null, linkedin_url: null, email: null, phone: null, location: null,
    priority, cadence_days: cadence, notes: null, last_contacted_at: days === null ? null : new Date(now.getTime() - days * 86_400_000).toISOString(),
    snoozed_until: null, created_at: now.toISOString(), updated_at: now.toISOString() };
}
describe("daily recommendations", () => {
  it("ranks meaningfully overdue people, includes new contacts, and excludes early contacts", () => {
    const rows = [contact("early", "normal", 45, 20), contact("overdue", "high", 21, 50), contact("new", "normal", 45, null)]
      .map((person) => decorateContact(person, null, now));
    const result = rankSuggestions(rows, now);
    expect(result.suggestions.map((person) => person.name)).toEqual(["overdue", "new"]);
    expect(result.upcoming.map((person) => person.name)).toEqual(["early"]);
    expect(result.suggestions[0].reason).toContain("50 days ago");
  });
  it("honors snoozes", () => {
    const person = decorateContact({ ...contact("later", "high", 21, 50), snoozed_until: "2026-09-29T12:00:00Z" }, null, now);
    expect(rankSuggestions([person], now).suggestions).toEqual([]);
  });
});
