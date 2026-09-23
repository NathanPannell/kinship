import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("./db", () => ({ query }));

import { commitOnboarding, dedupeOnboardingContacts, onboardingCommitSchema } from "./onboarding";

const contact = {
  name: " Maya Chen ",
  company: "Acme",
  role: "Director",
  linkedin_url: "https://linkedin.com/in/Maya/?trk=export",
  email: "MAYA@example.com",
  last_contacted_at: "2026-09-20T13:00:00-07:00",
  priority: "high" as const,
  cadence_days: 15,
};
const userId = "11111111-1111-4111-8111-111111111111";

describe("onboarding commit", () => {
  beforeEach(() => query.mockReset());

  it("normalizes profile URLs, email, and imported dates", () => {
    expect(onboardingCommitSchema.parse({ contacts: [contact] }).contacts[0]).toMatchObject({
      name: "Maya Chen",
      linkedin_url: "https://www.linkedin.com/in/Maya",
      email: "maya@example.com",
      last_contacted_at: "2026-09-20T20:00:00.000Z",
      location: null,
      photo_url: null,
    });
  });

  it("rejects invalid LinkedIn URLs, unsupported cadence values, and batches over 1,000", () => {
    expect(() => onboardingCommitSchema.parse({ contacts: [{ ...contact, linkedin_url: "https://example.com/in/maya" }] })).toThrow();
    expect(() => onboardingCommitSchema.parse({ contacts: [{ ...contact, cadence_days: 45 }] })).toThrow();
    expect(() => onboardingCommitSchema.parse({ contacts: Array.from({ length: 1001 }, () => contact) })).toThrow();
  });

  it("deduplicates canonical LinkedIn URLs and email addresses before writes", () => {
    const parsed = onboardingCommitSchema.parse({ contacts: [
      contact,
      { ...contact, name: "Maya duplicate", linkedin_url: "https://www.linkedin.com/in/maya" },
      { ...contact, name: "Other person", linkedin_url: "https://www.linkedin.com/in/other", email: "maya@example.com" },
    ] });
    const result = dedupeOnboardingContacts(parsed.contacts);
    expect(result.contacts).toHaveLength(1);
    expect(result.duplicatesSkipped).toBe(2);
  });

  it("upserts normalized contacts and stores only the imported date baseline", async () => {
    query.mockResolvedValueOnce([{ created: 1, updated: 0, contacts: [{ id: "contact-1", linkedin_url: "https://www.linkedin.com/in/Maya" }] }]);
    const result = await commitOnboarding(userId, { contacts: [contact] });

    expect(result).toMatchObject({ created: 1, updated: 0, duplicatesSkipped: 0, contacts: [{ id: "contact-1" }] });
    expect(query).toHaveBeenCalledOnce();
    const [statement, parameters] = query.mock.calls[0] as [string, string[]];
    const sent = JSON.parse(parameters[0]);
    expect(sent[0]).toMatchObject({ linkedin_url: "https://www.linkedin.com/in/Maya", email: "maya@example.com" });
    expect(statement).toContain("imported_last_contacted_at = GREATEST");
    expect(statement).toContain("last_contacted_at = GREATEST");
    expect(statement).toContain("c.owner_user_id = $2");
    expect(statement).toContain("owner_user_id, name");
    expect(parameters[1]).toBe(userId);
    expect(statement).not.toMatch(/INSERT\s+INTO\s+interactions/i);
  });

  it("matches an existing contact by email when the incoming row has a LinkedIn URL", async () => {
    query.mockResolvedValueOnce([{ created: 0, updated: 1, contacts: [{ id: "contact-existing", linkedin_url: contact.linkedin_url }] }]);
    await commitOnboarding(userId, { contacts: [contact] });

    const [statement] = query.mock.calls[0] as [string, string[]];
    expect(statement).toContain("email_candidate.id AS email_id");
    expect(statement).toContain("WHERE NOT (i.url_id IS NOT NULL AND i.email_id IS NOT NULL AND i.url_id <> i.email_id)");
    expect(statement).toContain("COALESCE(NULLIF(c.linkedin_url, ''), m.linkedin_url)");
    expect(statement).toContain("existing_id IS NULL OR match_rank = 1");
  });

  it("does not query the database when no contacts are selected", async () => {
    const result = await commitOnboarding(userId, { contacts: [] });
    expect(result).toMatchObject({ created: 0, updated: 0, duplicatesSkipped: 0, contacts: [] });
    expect(query).not.toHaveBeenCalled();
  });
});
