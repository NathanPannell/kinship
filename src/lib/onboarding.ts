import { z } from "zod";
import { query } from "./db";
import { normalizeLinkedinUrl } from "./import";

const optionalText = z.string().trim().max(2000).optional().nullable().transform((value) => value || null);
const linkedinUrl = z.union([z.url().max(2000), z.literal(""), z.null()]).optional().transform((value, context) => {
  if (!value) return null;
  const normalized = normalizeLinkedinUrl(value);
  if (!normalized) {
    context.addIssue({ code: "custom", message: "Use a valid LinkedIn profile URL" });
    return z.NEVER;
  }
  return normalized;
});
const email = z.union([z.email().max(320), z.literal(""), z.null()]).optional().transform((value) => value?.toLowerCase() || null);
const importedDate = z.union([z.iso.datetime({ offset: true }), z.literal(""), z.null()]).optional()
  .transform((value) => value ? new Date(value).toISOString() : null);
const photoUrl = z.string().trim().max(2000).url().optional().nullable().transform((value) => value || null)
  .refine((value) => !value || value.startsWith("https://"), "Photo URLs must use HTTPS");

const onboardingContactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: optionalText,
  role: optionalText,
  linkedin_url: linkedinUrl,
  email,
  last_contacted_at: importedDate,
  priority: z.enum(["high", "normal", "low"]),
  cadence_days: z.number().int().refine((value) => [7, 15, 30, 60].includes(value), "Choose a 7, 15, 30, or 60 day cadence"),
  location: optionalText,
  photo_url: photoUrl,
}).strict();

export const onboardingCommitSchema = z.object({
  contacts: z.array(onboardingContactSchema).max(1000, "Choose no more than 1,000 contacts"),
}).strict();

export type OnboardingContact = z.infer<typeof onboardingContactSchema>;

export function dedupeOnboardingContacts(contacts: OnboardingContact[]) {
  const seenUrls = new Set<string>();
  const seenEmails = new Set<string>();
  const seenFallbacks = new Set<string>();
  const unique: OnboardingContact[] = [];
  let duplicatesSkipped = 0;

  for (const contact of contacts) {
    const urlKey = contact.linkedin_url?.toLowerCase() ?? null;
    const emailKey = contact.email?.toLowerCase() ?? null;
    const fallbackKey = `${contact.name.toLocaleLowerCase()}\u0000${(contact.company ?? "").toLocaleLowerCase()}`;
    if ((urlKey && seenUrls.has(urlKey)) || (emailKey && seenEmails.has(emailKey)) || (!urlKey && !emailKey && seenFallbacks.has(fallbackKey))) {
      duplicatesSkipped += 1;
      continue;
    }
    if (urlKey) seenUrls.add(urlKey);
    if (emailKey) seenEmails.add(emailKey);
    if (!urlKey && !emailKey) seenFallbacks.add(fallbackKey);
    unique.push(contact);
  }

  return { contacts: unique, duplicatesSkipped };
}

export type OnboardingCommitResult = {
  created: number;
  updated: number;
  duplicatesSkipped: number;
  contacts: { id: string; linkedin_url: string | null }[];
};

export async function commitOnboarding(input: unknown): Promise<OnboardingCommitResult> {
  const parsed = onboardingCommitSchema.parse(input);
  const { contacts, duplicatesSkipped } = dedupeOnboardingContacts(parsed.contacts);
  if (contacts.length === 0) return { created: 0, updated: 0, duplicatesSkipped, contacts: [] };

  const [result] = await query<{
    created: number;
    updated: number;
    skipped: number;
    contacts: { id: string; linkedin_url: string | null }[];
  }>(
    `WITH incoming AS MATERIALIZED (
       SELECT row_number() OVER ()::int AS input_index, x.*
       FROM jsonb_to_recordset($1::jsonb) AS x(
         name text, company text, role text, linkedin_url text, email text,
         last_contacted_at timestamptz, priority text, cadence_days integer,
         location text, photo_url text
       )
     ),
     existing AS MATERIALIZED (
       SELECT c.*,
         regexp_replace(
           regexp_replace(
             regexp_replace(lower(c.linkedin_url), '^https?://(www\\.)?linkedin\\.com', 'https://www.linkedin.com'),
             '[?#].*$', ''
           ), '/+$', ''
         ) AS canonical_linkedin_url
       FROM contacts c
     ),
     identity_matches AS MATERIALIZED (
       SELECT i.*, url_candidate.id AS url_id, email_candidate.id AS email_id,
         fallback_candidate.id AS fallback_id
       FROM incoming i
       LEFT JOIN LATERAL (
         SELECT c.id FROM existing c
         WHERE i.linkedin_url IS NOT NULL AND c.canonical_linkedin_url = lower(i.linkedin_url)
         ORDER BY c.created_at, c.id
         LIMIT 1
       ) url_candidate ON true
       LEFT JOIN LATERAL (
         SELECT c.id FROM existing c
         WHERE i.email IS NOT NULL AND lower(c.email) = i.email
         ORDER BY c.created_at, c.id
         LIMIT 1
       ) email_candidate ON true
       LEFT JOIN LATERAL (
         SELECT c.id FROM existing c
         WHERE i.linkedin_url IS NULL AND i.email IS NULL
           AND lower(c.name) = lower(i.name)
           AND lower(coalesce(c.company, '')) = lower(coalesce(i.company, ''))
         ORDER BY c.created_at, c.id
         LIMIT 1
       ) fallback_candidate ON true
     ),
     ranked AS MATERIALIZED (
       SELECT matches.*,
         row_number() OVER (
           PARTITION BY COALESCE(matches.url_id, matches.email_id, matches.fallback_id)
           ORDER BY matches.input_index
         ) AS match_rank
       FROM (
         SELECT i.*, COALESCE(i.url_id, i.email_id, i.fallback_id) AS existing_id
         FROM identity_matches i
         WHERE NOT (i.url_id IS NOT NULL AND i.email_id IS NOT NULL AND i.url_id <> i.email_id)
       ) matches
     ),
     matching AS MATERIALIZED (
       SELECT * FROM ranked WHERE existing_id IS NULL OR match_rank = 1
     ),
     updated AS (
       UPDATE contacts c SET
         name = COALESCE(NULLIF(c.name, ''), m.name),
         company = COALESCE(NULLIF(c.company, ''), m.company),
         role = COALESCE(NULLIF(c.role, ''), m.role),
         linkedin_url = COALESCE(NULLIF(c.linkedin_url, ''), m.linkedin_url),
         email = COALESCE(NULLIF(c.email, ''), m.email),
         location = COALESCE(NULLIF(c.location, ''), m.location),
         photo_url = COALESCE(NULLIF(c.photo_url, ''), m.photo_url),
         priority = m.priority,
         cadence_days = m.cadence_days,
         imported_last_contacted_at = GREATEST(c.imported_last_contacted_at, m.last_contacted_at),
         last_contacted_at = GREATEST(c.last_contacted_at, m.last_contacted_at),
         updated_at = now()
       FROM matching m
       WHERE c.id = m.existing_id
       RETURNING c.id, c.linkedin_url, m.input_index
     ),
     inserted AS (
       INSERT INTO contacts (
         name, company, role, linkedin_url, email, location, photo_url,
         priority, cadence_days, imported_last_contacted_at, last_contacted_at
       )
       SELECT name, company, role, linkedin_url, email, location, photo_url,
         priority, cadence_days, last_contacted_at, last_contacted_at
       FROM matching
       WHERE existing_id IS NULL
       ON CONFLICT (linkedin_url) DO UPDATE SET
         name = COALESCE(NULLIF(contacts.name, ''), EXCLUDED.name),
         company = COALESCE(NULLIF(contacts.company, ''), EXCLUDED.company),
         role = COALESCE(NULLIF(contacts.role, ''), EXCLUDED.role),
         email = COALESCE(NULLIF(contacts.email, ''), EXCLUDED.email),
         location = COALESCE(NULLIF(contacts.location, ''), EXCLUDED.location),
         photo_url = COALESCE(NULLIF(contacts.photo_url, ''), EXCLUDED.photo_url),
         priority = EXCLUDED.priority,
         cadence_days = EXCLUDED.cadence_days,
         imported_last_contacted_at = GREATEST(contacts.imported_last_contacted_at, EXCLUDED.imported_last_contacted_at),
         last_contacted_at = GREATEST(contacts.last_contacted_at, EXCLUDED.last_contacted_at),
         updated_at = now()
       RETURNING id, linkedin_url, email, name, company
     ),
     resolved AS (
       SELECT input_index, id, linkedin_url FROM updated
       UNION ALL
       SELECT m.input_index, i.id, i.linkedin_url
       FROM matching m
       JOIN inserted i ON
         (m.linkedin_url IS NOT NULL AND i.linkedin_url = m.linkedin_url)
         OR (m.linkedin_url IS NULL AND m.email IS NOT NULL AND lower(i.email) = m.email)
         OR (m.linkedin_url IS NULL AND m.email IS NULL AND lower(i.name) = lower(m.name)
           AND lower(coalesce(i.company, '')) = lower(coalesce(m.company, '')))
       WHERE m.existing_id IS NULL
     ),
     summary AS (
       SELECT count(*) FILTER (WHERE existing_id IS NULL)::int AS created,
         count(*) FILTER (WHERE existing_id IS NOT NULL)::int AS updated,
         ((SELECT count(*) FROM incoming) - count(*))::int AS skipped
       FROM matching
     )
     SELECT summary.created, summary.updated, summary.skipped,
       COALESCE(
         json_agg(json_build_object('id', resolved.id, 'linkedin_url', resolved.linkedin_url)
           ORDER BY resolved.input_index) FILTER (WHERE resolved.id IS NOT NULL),
         '[]'::json
       ) AS contacts
     FROM summary LEFT JOIN resolved ON true
     GROUP BY summary.created, summary.updated, summary.skipped`,
    [JSON.stringify(contacts)],
  );

  return {
    created: Number(result?.created ?? 0),
    updated: Number(result?.updated ?? 0),
    duplicatesSkipped: duplicatesSkipped + Number(result?.skipped ?? 0),
    contacts: result?.contacts ?? [],
  };
}
