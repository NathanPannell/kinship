import type { Contact, Interaction, Suggestion } from "./types";

const dayMs = 86_400_000;
const priorityWeight = { high: 1.2, normal: 1, low: 0.85 } as const;

export function decorateContact(contact: Contact, latest: Interaction | null, now = new Date()): Suggestion {
  const last = contact.last_contacted_at ? new Date(contact.last_contacted_at) : null;
  const days = last ? Math.max(0, Math.floor((now.getTime() - last.getTime()) / dayMs)) : null;
  const next = last ? new Date(last.getTime() + contact.cadence_days * dayMs).toISOString() : null;
  const reason = days === null
    ? `No interaction logged yet. Target cadence: ${contact.cadence_days} days.`
    : `Last contacted ${days} ${days === 1 ? "day" : "days"} ago. Target cadence: ${contact.cadence_days} days.`;
  return { ...contact, days_since_contact: days, next_recommended_at: next, reason, latest_interaction: latest };
}

export function isDue(contact: Suggestion, now = new Date()): boolean {
  if (contact.snoozed_until && new Date(contact.snoozed_until) > now) return false;
  if (contact.days_since_contact === null) return true;
  return contact.days_since_contact >= contact.cadence_days;
}

export function rankSuggestions(contacts: Suggestion[], now = new Date()): { suggestions: Suggestion[]; upcoming: Suggestion[] } {
  const unsnoozed = contacts.filter((c) => !c.snoozed_until || new Date(c.snoozed_until) <= now);
  const score = (c: Suggestion) => (c.days_since_contact === null ? 1.1 : c.days_since_contact / c.cadence_days) * priorityWeight[c.priority];
  const sorted = [...unsnoozed].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  return {
    suggestions: sorted.filter((c) => isDue(c, now)).slice(0, 3),
    upcoming: sorted.filter((c) => !isDue(c, now)).sort((a, b) => (a.next_recommended_at ?? "").localeCompare(b.next_recommended_at ?? "")).slice(0, 3),
  };
}
