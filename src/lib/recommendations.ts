import type { Contact, Interaction, Suggestion } from "./types";

const dayMs = 86_400_000;
const priorityRank = { high: 0, normal: 1, low: 2 } as const;
const variationLimit = 0.33;
const centralLimit = variationLimit / 2;
const continuousStandardDeviation = 0.14980273702;
const intervalStandardDeviations = new Map<number, number>();

function normalCdf(value: number): number {
  const absolute = Math.abs(value);
  const reciprocal = 1 / (1 + 0.2316419 * absolute);
  const tail = 0.3989422804014327 * Math.exp(-absolute * absolute / 2) * reciprocal *
    (0.319381530 + reciprocal * (-0.356563782 + reciprocal *
    (1.781477937 + reciprocal * (-1.821255978 + reciprocal * 1.330274429))));
  return value < 0 ? tail : 1 - tail;
}

function centralShare(cadence: number, standardDeviation: number): number {
  const firstDay = Math.round(cadence * (1 - centralLimit));
  const lastDay = Math.round(cadence * (1 + centralLimit));
  const lower = Math.max(-variationLimit, (firstDay - 0.5) / cadence - 1);
  const upper = Math.min(variationLimit, (lastDay + 0.5) / cadence - 1);
  const total = normalCdf(variationLimit / standardDeviation) - normalCdf(-variationLimit / standardDeviation);
  return (normalCdf(upper / standardDeviation) - normalCdf(lower / standardDeviation)) / total;
}

function intervalStandardDeviation(cadence: number): number {
  const cached = intervalStandardDeviations.get(cadence);
  if (cached !== undefined) return cached;
  // Whole-day rounding expands some buckets. Solve for the standard deviation
  // that leaves 75% of the rounded dates in the central half of the window.
  // Very short cadences can have no outer day buckets at all.
  if (centralShare(cadence, 1) >= 0.75) {
    intervalStandardDeviations.set(cadence, continuousStandardDeviation);
    return continuousStandardDeviation;
  }
  let lower = 0.001;
  let upper = 1;
  for (let index = 0; index < 32; index++) {
    const middle = (lower + upper) / 2;
    if (centralShare(cadence, middle) > 0.75) lower = middle;
    else upper = middle;
  }
  const result = (lower + upper) / 2;
  intervalStandardDeviations.set(cadence, result);
  return result;
}

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function recommendedIntervalDays(contact: Pick<Contact, "id" | "last_contacted_at" | "cadence_days">): number {
  const cadence = contact.cadence_days;
  const standardDeviation = intervalStandardDeviation(cadence);
  const random = seededRandom(`${contact.id}\0${contact.last_contacted_at ?? ""}`);
  let variation: number;
  do {
    const first = Math.max(random(), Number.EPSILON);
    const second = random();
    variation = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second) * standardDeviation;
  } while (Math.abs(variation) > variationLimit);
  // Rejection above preserves the smooth bell curve through the cutoff.
  return Math.max(1, Math.round(cadence * (1 + variation)));
}

export function decorateContact(contact: Contact, latest: Interaction | null, now = new Date()): Suggestion {
  const last = contact.last_contacted_at ? new Date(contact.last_contacted_at) : null;
  const days = last ? Math.max(0, Math.floor((now.getTime() - last.getTime()) / dayMs)) : null;
  const next = last ? new Date(last.getTime() + recommendedIntervalDays(contact) * dayMs).toISOString() : null;
  const reason = days === null
    ? `No interaction logged yet. Target cadence: ${contact.cadence_days} days.`
    : `Last contacted ${days} ${days === 1 ? "day" : "days"} ago. Target cadence: ${contact.cadence_days} days.`;
  return { ...contact, days_since_contact: days, next_recommended_at: next, reason, latest_interaction: latest };
}

export function isDue(contact: Suggestion, now = new Date()): boolean {
  if (contact.snoozed_until && new Date(contact.snoozed_until) > now) return false;
  return !contact.next_recommended_at || new Date(contact.next_recommended_at) <= now;
}

export function rankSuggestions(contacts: Suggestion[], now = new Date()): { suggestions: Suggestion[]; upcoming: Suggestion[] } {
  const unsnoozed = contacts.filter((c) => !c.snoozed_until || new Date(c.snoozed_until) <= now);
  const overdue = (contact: Suggestion) => contact.next_recommended_at
    ? (now.getTime() - new Date(contact.next_recommended_at).getTime()) / dayMs
    : 0;
  return {
    suggestions: unsnoozed.filter((c) => isDue(c, now)).sort((a, b) =>
      priorityRank[a.priority] - priorityRank[b.priority] || overdue(b) - overdue(a) || a.name.localeCompare(b.name)).slice(0, 3),
    upcoming: unsnoozed.filter((c) => !isDue(c, now)).sort((a, b) =>
      (a.next_recommended_at ?? "").localeCompare(b.next_recommended_at ?? "") || priorityRank[a.priority] - priorityRank[b.priority] || a.name.localeCompare(b.name)).slice(0, 3),
  };
}
