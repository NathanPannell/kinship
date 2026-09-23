import { query } from "./db";
import { decorateContact, isDue, rankSuggestions } from "./recommendations";
import type { Contact, Interaction, Suggestion } from "./types";
import type { z } from "zod";
import { contactSchema, contactPatchSchema, bulkContactUpdateSchema, bulkContactDeleteSchema, interactionSchema, interactionPatchSchema } from "./validation";

const contactColumns = `id, name, company, role, linkedin_url, photo_url, email, phone, location, priority,
  cadence_days, notes, last_contacted_at, imported_last_contacted_at, snoozed_until, created_at, updated_at`;
const selectedContactColumns = contactColumns.split(",").map((column) => `c.${column.trim()}`).join(", ");

export async function allContacts(userId: string): Promise<Contact[]> {
  return query<Contact>(
    `SELECT ${selectedContactColumns}, p.updated_at AS uploaded_photo_updated_at
     FROM contacts c LEFT JOIN contact_photos p ON p.contact_id=c.id
     WHERE c.owner_user_id=$1 ORDER BY c.name ASC`,
    [userId],
  );
}

export async function hasContacts(userId: string): Promise<boolean> {
  const [result] = await query<{ has_contacts: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM contacts WHERE owner_user_id=$1) AS has_contacts",
    [userId],
  );
  return Boolean(result?.has_contacts);
}

export async function contactById(userId: string, id: string): Promise<Contact | null> {
  return (await query<Contact>(
    `SELECT ${selectedContactColumns}, p.updated_at AS uploaded_photo_updated_at
     FROM contacts c LEFT JOIN contact_photos p ON p.contact_id=c.id
     WHERE c.owner_user_id=$1 AND c.id=$2`,
    [userId, id],
  ))[0] ?? null;
}

export async function interactionsFor(userId: string, id: string): Promise<Interaction[]> {
  return query<Interaction>(
    `SELECT i.* FROM interactions i
     INNER JOIN contacts c ON c.id=i.contact_id
     WHERE c.owner_user_id=$1 AND i.contact_id=$2
     ORDER BY i.occurred_at DESC, i.created_at DESC`,
    [userId, id],
  );
}

export async function latestInteractions(userId: string): Promise<Map<string, Interaction>> {
  const rows = await query<Interaction>(
    `SELECT DISTINCT ON (i.contact_id) i.* FROM interactions i
     INNER JOIN contacts c ON c.id=i.contact_id
     WHERE c.owner_user_id=$1
     ORDER BY i.contact_id, i.occurred_at DESC, i.created_at DESC`,
    [userId],
  );
  return new Map(rows.map((row) => [row.contact_id, row]));
}

export async function decoratedContacts(userId: string, now = new Date()): Promise<Suggestion[]> {
  const [contacts, latest] = await Promise.all([allContacts(userId), latestInteractions(userId)]);
  return contacts.map((contact) => decorateContact(contact, latest.get(contact.id) ?? null, now));
}

export async function todaySuggestions(userId: string, now = new Date()) {
  return rankSuggestions(await decoratedContacts(userId, now), now);
}

export async function listContacts(userId: string, options: { search?: string; priority?: string; overdue?: string; sort?: string } = {}) {
  const search = options.search?.trim().toLowerCase();
  const rows = (await decoratedContacts(userId)).filter((contact) => {
    if (search && ![contact.name, contact.company, contact.role].some((part) => part?.toLowerCase().includes(search))) return false;
    if (options.priority && options.priority !== "all" && contact.priority !== options.priority) return false;
    if (options.overdue === "true" && !isDue(contact)) return false;
    return true;
  });
  if (options.sort === "next_due") rows.sort((a, b) => (a.next_recommended_at ?? "").localeCompare(b.next_recommended_at ?? ""));
  else rows.sort((a, b) => (a.last_contacted_at ?? "").localeCompare(b.last_contacted_at ?? ""));
  return rows;
}

export async function createContact(userId: string, input: z.infer<typeof contactSchema>): Promise<Contact> {
  const data = contactSchema.parse(input);
  const [contact] = await query<Contact>(
    `INSERT INTO contacts (owner_user_id, name, company, role, linkedin_url, photo_url, email, phone, location, priority, cadence_days, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${contactColumns}`,
    [userId, data.name, data.company, data.role, data.linkedin_url, data.photo_url, data.email, data.phone, data.location, data.priority, data.cadence_days, data.notes],
  );
  return contact;
}

export async function updateContact(userId: string, id: string, input: z.infer<typeof contactPatchSchema>): Promise<Contact | null> {
  const data = contactPatchSchema.parse(input);
  const existing = await contactById(userId, id);
  if (!existing) return null;
  const merged = { ...existing, ...data };
  const [contact] = await query<Contact>(
    `UPDATE contacts SET name=$3, company=$4, role=$5, linkedin_url=$6, photo_url=$7, email=$8, phone=$9, location=$10,
      priority=$11, cadence_days=$12, notes=$13, updated_at=now() WHERE owner_user_id=$1 AND id=$2 RETURNING *`,
    [userId, id, merged.name, merged.company, merged.role, merged.linkedin_url, merged.photo_url, merged.email, merged.phone, merged.location, merged.priority, merged.cadence_days, merged.notes],
  );
  return contact ? await contactById(userId, id) : null;
}

export async function updateContactsBulk(userId: string, input: z.infer<typeof bulkContactUpdateSchema>): Promise<number> {
  const { ids, updates } = bulkContactUpdateSchema.parse(input);
  const [result] = await query<{ count: number }>(
    `WITH updated AS (
      UPDATE contacts SET priority=COALESCE($3::text,priority), cadence_days=COALESCE($4::int,cadence_days), updated_at=now()
      WHERE owner_user_id=$1 AND id=ANY($2::uuid[]) RETURNING id
    ) SELECT COUNT(*)::int AS count FROM updated`,
    [userId, ids, updates.priority ?? null, updates.cadence_days ?? null],
  );
  return result.count;
}

export async function deleteContactsBulk(userId: string, input: z.infer<typeof bulkContactDeleteSchema>): Promise<number> {
  const { ids } = bulkContactDeleteSchema.parse(input);
  const [result] = await query<{ count: number }>(
    "WITH deleted AS (DELETE FROM contacts WHERE owner_user_id=$1 AND id=ANY($2::uuid[]) RETURNING id) SELECT COUNT(*)::int AS count FROM deleted",
    [userId, ids],
  );
  return result.count;
}

export async function deleteAllContacts(userId: string): Promise<number> {
  const [result] = await query<{ count: number }>(
    "WITH deleted AS (DELETE FROM contacts WHERE owner_user_id=$1 RETURNING id) SELECT COUNT(*)::int AS count FROM deleted",
    [userId],
  );
  return result.count;
}

async function refreshLastContacted(userId: string, contactId: string) {
  await query(
    `UPDATE contacts SET last_contacted_at=GREATEST(imported_last_contacted_at,(SELECT MAX(occurred_at) FROM interactions WHERE contact_id=$2)), updated_at=now()
     WHERE owner_user_id=$1 AND id=$2`,
    [userId, contactId],
  );
}

export async function createInteraction(userId: string, input: z.infer<typeof interactionSchema>): Promise<Interaction> {
  const data = interactionSchema.parse(input);
  const [interaction] = await query<Interaction>(
    `INSERT INTO interactions (contact_id, channel, note, occurred_at)
     SELECT c.id, $3, $4, COALESCE($5::timestamptz,now()) FROM contacts c
     WHERE c.owner_user_id=$1 AND c.id=$2
     RETURNING *`,
    [userId, data.contact_id, data.channel, data.note, data.occurred_at ?? null],
  );
  if (!interaction) {
    const error = new Error("Contact not found") as Error & { code: string };
    error.code = "23503";
    throw error;
  }
  await refreshLastContacted(userId, data.contact_id);
  return interaction;
}

export async function updateInteraction(userId: string, id: string, input: z.infer<typeof interactionPatchSchema>): Promise<Interaction | null> {
  const data = interactionPatchSchema.parse(input);
  const [interaction] = await query<Interaction>(
    `UPDATE interactions i SET channel=COALESCE($3,i.channel), note=COALESCE($4,i.note),
      occurred_at=COALESCE($5::timestamptz,i.occurred_at), updated_at=now()
     WHERE i.id=$2 AND EXISTS (
       SELECT 1 FROM contacts c WHERE c.id=i.contact_id AND c.owner_user_id=$1
     ) RETURNING i.*`,
    [userId, id, data.channel ?? null, data.note ?? null, data.occurred_at ?? null],
  );
  if (interaction) await refreshLastContacted(userId, interaction.contact_id);
  return interaction ?? null;
}

export async function deleteInteraction(userId: string, id: string): Promise<boolean> {
  const [interaction] = await query<Interaction>(
    `DELETE FROM interactions i WHERE i.id=$2 AND EXISTS (
       SELECT 1 FROM contacts c WHERE c.id=i.contact_id AND c.owner_user_id=$1
     ) RETURNING i.*`,
    [userId, id],
  );
  if (interaction) await refreshLastContacted(userId, interaction.contact_id);
  return !!interaction;
}

export async function snoozeContact(userId: string, id: string, days: number) {
  const [contact] = await query<Contact>(
    `UPDATE contacts SET snoozed_until=now()+($3::int * interval '1 day'), updated_at=now()
     WHERE owner_user_id=$1 AND id=$2 RETURNING ${contactColumns}`,
    [userId, id, days],
  );
  return contact ?? null;
}
