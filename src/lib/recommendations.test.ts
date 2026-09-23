import { describe, expect, it } from "vitest";
import { decorateContact, isDue, rankSuggestions, recommendedIntervalDays } from "./recommendations";
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
  it("keeps a bell shaped interval fixed throughout a contact cycle", () => {
    const samples = Array.from({ length: 10_000 }, (_, index) =>
      recommendedIntervalDays(contact(`person-${index}`, "normal", 300, 5)));
    const middleShare = samples.filter((days) => days >= 251 && days <= 350).length / samples.length;
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(201);
    expect(Math.max(...samples)).toBeLessThanOrEqual(399);
    expect(middleShare).toBeGreaterThan(0.73);
    expect(middleShare).toBeLessThan(0.77);

    const monthSamples = Array.from({ length: 20_000 }, (_, index) =>
      recommendedIntervalDays(contact(`month-${index}`, "normal", 30, 5)));
    const monthMiddleShare = monthSamples.filter((days) => days >= 25 && days <= 35).length / monthSamples.length;
    expect(Math.min(...monthSamples)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...monthSamples)).toBeLessThanOrEqual(40);
    expect(monthMiddleShare).toBeGreaterThan(0.73);
    expect(monthMiddleShare).toBeLessThan(0.77);

    const person = contact("stable", "normal", 30, 40);
    const first = decorateContact(person, null, now);
    expect(decorateContact(person, null, new Date("2026-09-25T12:00:00Z")).next_recommended_at).toBe(first.next_recommended_at);
    expect(recommendedIntervalDays(person)).toBeGreaterThanOrEqual(20);
    expect(recommendedIntervalDays(person)).toBeLessThanOrEqual(40);
    const nextCycle = { ...person, last_contacted_at: now.toISOString() };
    expect(isDue(decorateContact(nextCycle, null, now), now)).toBe(false);
  });
  it("puts due high priority contacts ahead of older low priority contacts", () => {
    const rows = [
      contact("low old", "low", 21, 120),
      contact("normal old", "normal", 21, 100),
      contact("high recent", "high", 21, 30),
      contact("high new", "high", 21, null),
    ].map((person) => decorateContact(person, null, now));
    expect(rankSuggestions(rows, now).suggestions.map((person) => person.name))
      .toEqual(["high recent", "high new", "normal old"]);
  });
});
