import Papa from "papaparse";
import { query } from "./db";
import type { Contact } from "./types";

export type ImportedContact = { name: string; company: string | null; role: string | null; linkedin_url: string | null; email: string | null };
export type ImportPlan = { create: ImportedContact[]; update: (ImportedContact & { match_id: string })[]; skipped: ImportedContact[] };

function pick(row: Record<string, string>, ...names: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value?.trim() ?? ""]));
  return names.map((name) => normalized.get(name.toLowerCase().replace(/[^a-z0-9]/g, "")) ?? "").find(Boolean) ?? "";
}

export function normalizeLinkedinUrl(input: string): string | null {
  if (!input.trim()) return null;
  try {
    const url = new URL(input.trim());
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
    return `https://www.linkedin.com${url.pathname.replace(/\/+$/, "")}`;
  } catch { return null; }
}

export function parseConnections(csv: string): ImportedContact[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /first\s*name/i.test(line) && /last\s*name/i.test(line));
  if (headerIndex < 0) throw new Error("Could not find LinkedIn connection headings");
  const parsed = Papa.parse<Record<string, string>>(lines.slice(headerIndex).join("\n"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error("Could not parse CSV");
  return parsed.data.map((row) => ({
    name: [pick(row, "First Name", "Firstname"), pick(row, "Last Name", "Lastname")].filter(Boolean).join(" ").trim(),
    company: pick(row, "Company", "Current Company") || null,
    role: pick(row, "Position", "Title", "Role") || null,
    linkedin_url: normalizeLinkedinUrl(pick(row, "URL", "Profile URL", "LinkedIn URL")),
    email: pick(row, "Email Address", "Email").toLowerCase() || null,
  })).filter((row) => row.name);
}

export function planImport(incoming: ImportedContact[], existing: Contact[]): ImportPlan {
  const byUrl = new Map(existing.filter((c) => c.linkedin_url).map((c) => [normalizeLinkedinUrl(c.linkedin_url!), c]));
  const byEmail = new Map(existing.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]));
  const byNameCompany = new Map(existing.map((c) => [`${c.name.toLowerCase()}|${c.company?.toLowerCase() ?? ""}`, c]));
  const seenUrls = new Set<string>();
  const seenEmails = new Set<string>();
  const seenMatches = new Set<string>();
  const seenFallback = new Set<string>();
  const plan: ImportPlan = { create: [], update: [], skipped: [] };
  for (const row of incoming) {
    const fallback = `${row.name.toLowerCase()}|${row.company?.toLowerCase() ?? ""}`;
    if ((row.linkedin_url && seenUrls.has(row.linkedin_url)) || (row.email && seenEmails.has(row.email)) || (!row.linkedin_url && !row.email && seenFallback.has(fallback))) {
      plan.skipped.push(row); continue;
    }
    if (row.linkedin_url) seenUrls.add(row.linkedin_url);
    if (row.email) seenEmails.add(row.email);
    if (!row.linkedin_url && !row.email) seenFallback.add(fallback);
    const urlMatch = row.linkedin_url ? byUrl.get(row.linkedin_url) : undefined;
    const emailMatch = row.email ? byEmail.get(row.email) : undefined;
    if (urlMatch && emailMatch && urlMatch.id !== emailMatch.id) { plan.skipped.push(row); continue; }
    const match = urlMatch || emailMatch || (!row.linkedin_url && !row.email ? byNameCompany.get(fallback) : undefined);
    if (!match) { plan.create.push(row); continue; }
    if (seenMatches.has(match.id)) { plan.skipped.push(row); continue; }
    seenMatches.add(match.id);
    if ((!match.company && row.company) || (!match.role && row.role) || (!match.email && row.email) || (!match.linkedin_url && row.linkedin_url)) plan.update.push({ ...row, match_id: match.id });
    else plan.skipped.push(row);
  }
  return plan;
}

export async function commitImport(plan: ImportPlan) {
  let created = 0;
  let updated = 0;
  for (let i = 0; i < plan.create.length; i += 500) {
    const batch = plan.create.slice(i, i + 500);
    const rows = await query<{ id: string }>(
      `WITH incoming AS (SELECT * FROM jsonb_to_recordset($1::jsonb)
        AS x(name text, company text, role text, linkedin_url text, email text))
       INSERT INTO contacts (name, company, role, linkedin_url, email, priority, cadence_days)
       SELECT name, company, role, linkedin_url, email, 'normal', 45 FROM incoming x
       WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE
         (x.linkedin_url IS NOT NULL AND c.linkedin_url=x.linkedin_url) OR
         (x.email IS NOT NULL AND lower(c.email)=x.email) OR
         (x.linkedin_url IS NULL AND x.email IS NULL AND lower(c.name)=lower(x.name) AND lower(coalesce(c.company,''))=lower(coalesce(x.company,''))))
       ON CONFLICT (linkedin_url) DO NOTHING RETURNING id`, [JSON.stringify(batch)],
    );
    created += rows.length;
  }
  for (let i = 0; i < plan.update.length; i += 500) {
    const batch = plan.update.slice(i, i + 500);
    const rows = await query<{ id: string }>(
      `WITH incoming AS (SELECT * FROM jsonb_to_recordset($1::jsonb)
        AS x(match_id uuid, company text, role text, linkedin_url text, email text))
       UPDATE contacts c SET company=COALESCE(NULLIF(c.company,''),x.company),
         role=COALESCE(NULLIF(c.role,''),x.role), email=COALESCE(NULLIF(c.email,''),x.email),
         linkedin_url=COALESCE(c.linkedin_url,x.linkedin_url), updated_at=now()
       FROM incoming x WHERE c.id=x.match_id RETURNING c.id`, [JSON.stringify(batch)],
    );
    updated += rows.length;
  }
  return { created, updated, skipped: plan.skipped.length + (plan.create.length - created) + (plan.update.length - updated) };
}
