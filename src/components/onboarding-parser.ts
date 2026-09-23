import Papa from "papaparse";
import type { Priority } from "./crm-types";

export type OnboardingContact = {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  linkedin_url: string | null;
  email: string | null;
  last_contacted_at: string | null;
  priority: Priority;
  cadence_days: 7 | 15 | 30 | 60;
};

export type MessageMatchResult = {
  contacts: OnboardingContact[];
  messageCount: number;
  matchedCount: number;
};

type CsvRow = Record<string, string>;

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(row: CsvRow, ...names: string[]) {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value?.trim() ?? ""]),
  );
  return names
    .map((name) => normalized.get(normalizeHeader(name)) ?? "")
    .find(Boolean) ?? "";
}

function findHeaderLine(text: string, kind: "connections" | "messages") {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const index = lines.findIndex((line) => {
    const normalized = normalizeHeader(line);
    if (kind === "connections") {
      return normalized.includes("firstname") && normalized.includes("lastname");
    }
    return normalized.includes("date") &&
      (normalized.includes("senderprofileurl") || normalized.includes("from")) &&
      (normalized.includes("recipientprofileurls") || normalized.includes("to"));
  });
  if (index < 0) {
    throw new Error(kind === "connections"
      ? "We could not find the First Name and Last Name columns in this CSV. Choose your LinkedIn Connections export."
      : "We could not find the message date and participant columns in this CSV. Choose your LinkedIn messages export.");
  }
  return { lines, index };
}

async function parseFileRows(file: File, kind: "connections" | "messages"): Promise<CsvRow[]> {
  const text = await file.text();
  const { lines, index } = findHeaderLine(text, kind);
  const csv = lines.slice(index).join("\n");
  if (!csv.trim()) return [];

  // Parse local files in a worker so large message exports do not lock the page.
  const csvFile = new File([csv], file.name, { type: "text/csv" });
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(csvFile, {
      header: true,
      skipEmptyLines: "greedy",
      worker: true,
      complete: (result) => {
        const fatal = result.errors.find((error) =>
          error.code === "MissingQuotes" || error.code === "TooManyFields",
        );
        if (fatal) {
          reject(new Error("This CSV has a row we could not read. Re-export it from LinkedIn and try again."));
          return;
        }
        resolve(result.data);
      },
      error: () => reject(new Error("The CSV could not be read. Try exporting it from LinkedIn again.")),
    });
  });
}

export function normalizeLinkedinUrl(input: string) {
  const candidate = input.trim().replace(/^<|>$/g, "");
  if (!candidate) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
    const path = url.pathname.replace(/\/+$/, "");
    return path ? `https://www.linkedin.com${path}`.toLowerCase() : null;
  } catch {
    return null;
  }
}

function extractLinkedinUrls(input: string) {
  const candidates = input.match(/(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/[^\s,;<>]+/gi) ?? [];
  return [...new Set(candidates.map(normalizeLinkedinUrl).filter((value): value is string => Boolean(value)))];
}

function personKey(input: string) {
  return input.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function connectionKey(contact: Omit<OnboardingContact, "id">) {
  if (contact.linkedin_url) return `url:${contact.linkedin_url}`;
  if (contact.email) return `email:${contact.email.toLocaleLowerCase()}`;
  return `name:${personKey(contact.name)}|${personKey(contact.company ?? "")}`;
}

function fallbackNameFromProfile(url: string | null) {
  if (!url) return "Unnamed LinkedIn connection";
  const handle = decodeURIComponent(url.split("/").filter(Boolean).at(-1) ?? "");
  return handle ? `LinkedIn connection (${handle})` : "Unnamed LinkedIn connection";
}

export async function parseConnections(file: File): Promise<OnboardingContact[]> {
  const rows = await parseFileRows(file, "connections");
  const contactsByKey = new Map<string, Omit<OnboardingContact, "id">>();

  for (const row of rows) {
    const linkedinUrl = normalizeLinkedinUrl(pick(row, "URL", "Profile URL", "LinkedIn URL"));
    const suppliedName = [pick(row, "First Name", "Firstname"), pick(row, "Last Name", "Lastname")]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (!suppliedName && !linkedinUrl) continue;

    const contact: Omit<OnboardingContact, "id"> = {
      name: suppliedName || fallbackNameFromProfile(linkedinUrl),
      company: pick(row, "Company", "Current Company") || null,
      role: pick(row, "Position", "Title", "Role") || null,
      linkedin_url: linkedinUrl,
      email: pick(row, "Email Address", "Email").toLocaleLowerCase() || null,
      last_contacted_at: null,
      priority: "normal",
      cadence_days: 30,
    };
    const key = connectionKey(contact);
    const existing = contactsByKey.get(key);
    if (!existing) {
      contactsByKey.set(key, contact);
      continue;
    }
    contactsByKey.set(key, {
      ...existing,
      company: existing.company || contact.company,
      role: existing.role || contact.role,
      linkedin_url: existing.linkedin_url || contact.linkedin_url,
      email: existing.email || contact.email,
    });
  }

  return [...contactsByKey.values()].map((contact, index) => ({ ...contact, id: `person-${index}` }));
}

function parseMessageDate(input: string) {
  const value = input.trim();
  if (!value) return null;
  const utcValue = value.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+UTC$/i);
  const parsed = Date.parse(utcValue ? `${utcValue[1]}T${utcValue[2]}Z` : value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function maxDate(previous: string | null, next: string) {
  if (!previous) return next;
  return Date.parse(next) > Date.parse(previous) ? next : previous;
}

function resolveExactName(input: string, nameIndex: Map<string, number[]>) {
  const exactMatches = nameIndex.get(personKey(input)) ?? [];
  return exactMatches.length === 1 ? exactMatches : [];
}

function resolveRecipients(input: string, nameIndex: Map<string, number[]>) {
  const wholeMatch = resolveExactName(input, nameIndex);
  if (wholeMatch.length) return wholeMatch;

  const pieces = input.split(/\s*(?:;|\||,)\s*/).map((part) => part.trim()).filter(Boolean);
  const matches = new Set<number>();
  for (const piece of pieces) {
    for (const index of resolveExactName(piece, nameIndex)) matches.add(index);
  }
  return [...matches];
}

export async function matchMessageDates(
  file: File,
  sourceContacts: OnboardingContact[],
): Promise<MessageMatchResult> {
  const rows = await parseFileRows(file, "messages");
  const contacts = sourceContacts.map((contact) => ({ ...contact }));
  const urlIndex = new Map<string, number>();
  const nameIndex = new Map<string, number[]>();

  contacts.forEach((contact, index) => {
    if (contact.linkedin_url) urlIndex.set(contact.linkedin_url, index);
    const key = personKey(contact.name);
    nameIndex.set(key, [...(nameIndex.get(key) ?? []), index]);
  });

  const touched = new Set<number>();
  let messageCount = 0;

  for (const row of rows) {
    const date = parseMessageDate(pick(row, "DATE", "Date", "Sent Date"));
    if (!date) continue;
    messageCount += 1;

    const senderUrl = normalizeLinkedinUrl(pick(row, "SENDER PROFILE URL", "Sender Profile URL"));
    const recipientsValue = pick(row, "RECIPIENT PROFILE URLS", "Recipient Profile URLs");
    const recipientUrls = extractLinkedinUrls(recipientsValue);
    const participants = new Set<number>();

    if (senderUrl) {
      const index = urlIndex.get(senderUrl);
      if (index !== undefined) participants.add(index);
    } else {
      for (const index of resolveExactName(pick(row, "FROM", "From", "Sender"), nameIndex)) participants.add(index);
    }

    if (recipientUrls.length) {
      for (const url of recipientUrls) {
        const index = urlIndex.get(url);
        if (index !== undefined) participants.add(index);
      }
    } else {
      for (const index of resolveRecipients(pick(row, "TO", "To", "Recipients"), nameIndex)) participants.add(index);
    }

    for (const index of participants) {
      contacts[index].last_contacted_at = maxDate(contacts[index].last_contacted_at, date);
      touched.add(index);
    }
  }

  return { contacts, messageCount, matchedCount: touched.size };
}
