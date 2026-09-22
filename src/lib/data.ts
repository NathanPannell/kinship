import { query } from "./db";
import { decorateContact, rankSuggestions } from "./recommendations";
import type { Contact, Interaction, Suggestion } from "./types";
import type { z } from "zod";
import { contactSchema, contactPatchSchema, interactionSchema, interactionPatchSchema } from "./validation";

export async function allContacts(): Promise<Contact[]> {
  return query<Contact>("SELECT * FROM contacts ORDER BY name ASC");
}

export async function contactById(id: string): Promise<Contact | null> {
  return (await query<Contact>("SELECT * FROM contacts WHERE id = $1", [id]))[0] ?? null;
}

export async function interactionsFor(id: string): Promise<Interaction[]> {
  return query<Interaction>("SELECT * FROM interactions WHERE contact_id = $1 ORDER BY occurred_at DESC, created_at DESC", [id]);
}

export async function latestInteractions(): Promise<Map<string, Interaction>> {
  const rows = await query<Interaction>("SELECT DISTINCT ON (contact_id) * FROM interactions ORDER BY contact_id, occurred_at DESC, created_at DESC");
  return new Map(rows.map((row) => [row.contact_id, row]));
}

export async function decoratedContacts(now = new Date()): Promise<Suggestion[]> {
  const [contacts, latest] = await Promise.all([allContacts(), latestInteractions()]);
  return contacts.map((contact) => decorateContact(contact, latest.get(contact.id) ?? null, now));
}

export async function todaySuggestions(now = new Date()) {
  return rankSuggestions(await decoratedContacts(now), now);
}

export async function listContacts(options: { search?: string; priority?: string; overdue?: string; sort?: string } = {}) {
  const search = options.search?.trim().toLowerCase();
  const rows = (await decoratedContacts()).filter((contact) => {
    if (search && ![contact.name, contact.company, contact.role].some((part) => part?.toLowerCase().includes(search))) return false;
    if (options.priority && options.priority !== "all" && contact.priority !== options.priority) return false;
    if (options.overdue === "true" && (contact.days_since_contact !== null && contact.days_since_contact < contact.cadence_days)) return false;
    return true;
  });
  if (options.sort === "next_due") rows.sort((a, b) => (a.next_recommended_at ?? "").localeCompare(b.next_recommended_at ?? ""));
  else rows.sort((a, b) => (a.last_contacted_at ?? "").localeCompare(b.last_contacted_at ?? ""));
  return rows;
}

export async function createContact(input: z.infer<typeof contactSchema>): Promise<Contact> {
  const data = contactSchema.parse(input);
  const [contact] = await query<Contact>(
    `INSERT INTO contacts (name, company, role, linkedin_url, email, phone, location, priority, cadence_days, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [data.name, data.company, data.role, data.linkedin_url, data.email, data.phone, data.location, data.priority, data.cadence_days, data.notes],
  );
  return contact;
}

export async function updateContact(id: string, input: z.infer<typeof contactPatchSchema>): Promise<Contact | null> {
  const data = contactPatchSchema.parse(input);
  const existing = await contactById(id);
  if (!existing) return null;
  const merged = { ...existing, ...data };
  const [contact] = await query<Contact>(
    `UPDATE contacts SET name=$2, company=$3, role=$4, linkedin_url=$5, email=$6, phone=$7, location=$8,
      priority=$9, cadence_days=$10, notes=$11, updated_at=now() WHERE id=$1 RETURNING *`,
    [id, merged.name, merged.company, merged.role, merged.linkedin_url, merged.email, merged.phone, merged.location, merged.priority, merged.cadence_days, merged.notes],
  );
  return contact ?? null;
}

async function refreshLastContacted(contactId: string) {
  await query("UPDATE contacts SET last_contacted_at=(SELECT MAX(occurred_at) FROM interactions WHERE contact_id=$1), updated_at=now() WHERE id=$1", [contactId]);
}

export async function createInteraction(input: z.infer<typeof interactionSchema>): Promise<Interaction> {
  const data = interactionSchema.parse(input);
  const [interaction] = await query<Interaction>(
    "INSERT INTO interactions (contact_id, channel, note, occurred_at) VALUES ($1,$2,$3,COALESCE($4::timestamptz,now())) RETURNING *",
    [data.contact_id, data.channel, data.note, data.occurred_at ?? null],
  );
  await refreshLastContacted(data.contact_id);
  return interaction;
}

export async function updateInteraction(id: string, input: z.infer<typeof interactionPatchSchema>): Promise<Interaction | null> {
  const data = interactionPatchSchema.parse(input);
  const [interaction] = await query<Interaction>(
    `UPDATE interactions SET channel=COALESCE($2,channel), note=COALESCE($3,note),
      occurred_at=COALESCE($4::timestamptz,occurred_at), updated_at=now() WHERE id=$1 RETURNING *`,
    [id, data.channel ?? null, data.note ?? null, data.occurred_at ?? null],
  );
  if (interaction) await refreshLastContacted(interaction.contact_id);
  return interaction ?? null;
}

export async function deleteInteraction(id: string): Promise<boolean> {
  const [interaction] = await query<Interaction>("DELETE FROM interactions WHERE id=$1 RETURNING *", [id]);
  if (interaction) await refreshLastContacted(interaction.contact_id);
  return !!interaction;
}

export async function snoozeContact(id: string, days: number) {
  const [contact] = await query<Contact>("UPDATE contacts SET snoozed_until=now()+($2::int * interval '1 day'), updated_at=now() WHERE id=$1 RETURNING *", [id, days]);
  return contact ?? null;
}
