import { describe, expect, it } from "vitest";
import { normalizeLinkedinUrl, parseConnections, planImport } from "./import";
import type { Contact } from "./types";
const base = { id: "a", name: "Maya Chen", company: null, role: null, linkedin_url: "https://www.linkedin.com/in/maya", email: null, phone: null,
  location: null, priority: "high" as const, cadence_days: 21, notes: "My note", last_contacted_at: null, snoozed_until: null, created_at: "", updated_at: "" };
describe("LinkedIn import", () => {
  it("normalizes URLs and tolerates alternate headings", () => {
    const rows = parseConnections("First Name,Last Name,Profile URL,Email,Current Company,Title\nMaya,Chen,https://linkedin.com/in/maya/?trk=x,maya@example.com,Acme,Director");
    expect(rows[0]).toMatchObject({ name: "Maya Chen", linkedin_url: "https://www.linkedin.com/in/maya", company: "Acme", role: "Director" });
    expect(normalizeLinkedinUrl("https://example.com/in/maya")).toBeNull();
  });
  it("updates only missing fields and skips duplicate export rows", () => {
    const incoming = parseConnections("First Name,Last Name,URL,Company,Position\nMaya,Chen,https://linkedin.com/in/maya,Acme,Director\nMaya,Chen,https://linkedin.com/in/maya,Acme,Director\nSam,Lee,https://linkedin.com/in/sam,Wave,Engineer");
    const plan = planImport(incoming, [base as Contact]);
    expect(plan.update).toHaveLength(1);
    expect(plan.create).toHaveLength(1);
    expect(plan.skipped).toHaveLength(1);
  });
  it("skips shared emails and conflicting existing identities", () => {
    const first = { name: "First", company: "A", role: null, linkedin_url: "https://www.linkedin.com/in/first", email: "shared@example.com" };
    const second = { name: "Second", company: "B", role: null, linkedin_url: "https://www.linkedin.com/in/second", email: "shared@example.com" };
    expect(planImport([first, second], []).create).toHaveLength(1);
    const samePerson = [{ ...base, linkedin_url: null, email: "shared@example.com" }] as Contact[];
    const samePersonPlan = planImport([first, second], samePerson);
    expect(samePersonPlan.update).toHaveLength(1);
    expect(samePersonPlan.skipped).toHaveLength(1);
    const existing = [{ ...base, id: "a", email: "shared@example.com" }, { ...base, id: "b", linkedin_url: second.linkedin_url, email: "other@example.com" }] as Contact[];
    const plan = planImport([first, second], existing);
    expect(plan.update).toHaveLength(1);
    expect(plan.skipped).toHaveLength(1);
    expect(planImport([second], existing).skipped).toHaveLength(1);
  });
});
