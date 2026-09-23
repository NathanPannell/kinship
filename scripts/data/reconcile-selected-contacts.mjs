import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const selectionPath = path.join(scriptDirectory, "selected-people.json");
const projectDirectory = path.resolve(scriptDirectory, "../..");
const privateDataDirectory = path.join(projectDirectory, ".codex", "private-data");
const defaultOutputPath = path.join(privateDataDirectory, "reconciled-contacts.json");

function parseArguments(args) {
  const options = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key.startsWith("--") || !args[index + 1] || args[index + 1].startsWith("--")) {
      throw new Error("Use --export-dir <directory> and optionally --output <file>.");
    }
    options.set(key, args[index + 1]);
    index += 1;
  }
  const exportDirectory = options.get("--export-dir");
  if (!exportDirectory) {
    throw new Error("Use --export-dir <directory> and optionally --output <file>.");
  }
  const outputPath = path.resolve(options.get("--output") ?? defaultOutputPath);
  const relativeOutput = path.relative(privateDataDirectory, outputPath);
  if (!relativeOutput || relativeOutput === ".." || relativeOutput.startsWith(`..${path.sep}`) || path.isAbsolute(relativeOutput)) {
    throw new Error("The derived output must stay inside .codex/private-data.");
  }
  return {
    exportDirectory: path.resolve(exportDirectory),
    outputPath,
  };
}

function normalizeHeader(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function personKey(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizeLinkedinUrl(input) {
  const candidate = String(input ?? "").trim().replace(/^<|>$/g, "");
  if (!candidate) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
    const pathname = url.pathname.replace(/\/+$/, "");
    return pathname ? `https://www.linkedin.com${pathname}`.toLowerCase() : null;
  } catch {
    return null;
  }
}

function extractLinkedinUrls(input) {
  const candidates = String(input ?? "").match(/(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/[^\s,;<>]+/gi) ?? [];
  return [...new Set(candidates.map(normalizeLinkedinUrl).filter(Boolean))];
}

function pick(row, ...names) {
  const normalizedRow = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), String(value ?? "").trim()]),
  );
  return names.map((name) => normalizedRow.get(normalizeHeader(name)) ?? "").find(Boolean) ?? "";
}

function findHeaderLine(text, kind) {
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
    throw new Error(`Could not find the ${kind} CSV header.`);
  }
  return { lines, index };
}

async function parseCsvFile(filePath, kind) {
  const text = await readFile(filePath, "utf8");
  const { lines, index } = findHeaderLine(text, kind);
  const csv = lines.slice(index).join("\n");
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: "greedy" });
  const fatal = parsed.errors.find((error) =>
    error.code === "MissingQuotes" || error.code === "TooManyFields" || error.code === "TooFewFields",
  );
  if (fatal) {
    throw new Error(`Could not parse the ${kind} CSV (${fatal.code}).`);
  }
  return { rows: parsed.data.filter((row) => Object.values(row).some((value) => String(value ?? "").trim())), headerLine: index + 1 };
}

function parseMessageDate(input) {
  const value = String(input ?? "").trim();
  if (!value) return null;
  const utcValue = value.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+UTC$/i);
  const parsed = Date.parse(utcValue ? `${utcValue[1]}T${utcValue[2]}Z` : value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function resolveExactName(input, nameIndex) {
  const matches = nameIndex.get(personKey(input)) ?? [];
  return matches.length === 1 ? matches : [];
}

function resolveRecipients(input, nameIndex) {
  const wholeMatch = resolveExactName(input, nameIndex);
  if (wholeMatch.length) return wholeMatch;
  const pieces = String(input ?? "").split(/\s*(?:;|\||,)\s*/).map((part) => part.trim()).filter(Boolean);
  const matches = new Set();
  for (const piece of pieces) {
    for (const index of resolveExactName(piece, nameIndex)) matches.add(index);
  }
  return [...matches];
}

function connectionFingerprint(row) {
  const values = [row.firstName, row.lastName, row.profileUrl, row.email, row.company, row.position, row.connectedOn];
  return createHash("sha256").update(JSON.stringify(values), "utf8").digest("hex");
}

function summarize(items, key) {
  return items.reduce((counts, item) => {
    const value = String(item[key]);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function publicSummary(summary) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

async function main() {
  const { exportDirectory, outputPath } = parseArguments(process.argv.slice(2));
  const selection = JSON.parse(await readFile(selectionPath, "utf8"));
  const { rows: connectionRows, headerLine: connectionsHeaderLine } = await parseCsvFile(
    path.join(exportDirectory, "Connections.csv"),
    "connections",
  );
  const { rows: messageRows, headerLine: messagesHeaderLine } = await parseCsvFile(path.join(exportDirectory, "messages.csv"), "messages");

  const connections = connectionRows.map((row, index) => {
    const firstName = pick(row, "First Name", "Firstname");
    const lastName = pick(row, "Last Name", "Lastname");
    return {
      recordNumber: index + 1,
      name: [firstName, lastName].filter(Boolean).join(" ").trim(),
      firstName,
      lastName,
      profileUrl: normalizeLinkedinUrl(pick(row, "URL", "Profile URL", "LinkedIn URL")),
      email: pick(row, "Email Address", "Email").toLowerCase(),
      company: pick(row, "Company", "Current Company"),
      position: pick(row, "Position", "Title", "Role"),
      connectedOn: pick(row, "Connected On"),
    };
  });

  const urlIndex = new Map();
  const nameIndex = new Map();
  connections.forEach((connection, index) => {
    if (connection.profileUrl) {
      urlIndex.set(connection.profileUrl, [...(urlIndex.get(connection.profileUrl) ?? []), index]);
    }
    const key = personKey(connection.name);
    if (key) nameIndex.set(key, [...(nameIndex.get(key) ?? []), index]);
  });

  const issues = {
    invalidSelectionOrdinals: [],
    duplicateSelectionOrdinals: [],
    missingConnectionOrdinals: [],
    ambiguousConnectionOrdinals: [],
    invalidRelevantMessageDateRows: 0,
    ambiguousSelectedMessageRows: 0,
  };
  const seenSelections = new Set();
  const seenOrdinals = new Set();
  const mapped = [];

  for (const [index, person] of selection.entries()) {
    const ordinal = Number.isInteger(person.ordinal) ? person.ordinal : index + 1;
    const validPreference = ["low", "normal", "high"].includes(person.priority) && [7, 15, 30, 60].includes(person.cadenceDays);
    if (!person.name || !validPreference || !Number.isInteger(ordinal) || ordinal !== index + 1 || seenOrdinals.has(ordinal)) {
      issues.invalidSelectionOrdinals.push(ordinal);
    }
    seenOrdinals.add(ordinal);
    const selectionKey = `${personKey(person.name)}|${normalizeText(person.company)}|${normalizeText(person.role)}`;
    if (seenSelections.has(selectionKey)) issues.duplicateSelectionOrdinals.push(ordinal);
    seenSelections.add(selectionKey);

    const nameMatches = connections.filter((connection) => personKey(connection.name) === personKey(person.name));
    let candidates = nameMatches;
    if (person.company) candidates = candidates.filter((connection) => normalizeText(connection.company) === normalizeText(person.company));
    if (person.role) candidates = candidates.filter((connection) => normalizeText(connection.position) === normalizeText(person.role));

    if (candidates.length === 0) {
      issues.missingConnectionOrdinals.push(ordinal);
      continue;
    }
    if (candidates.length !== 1 || !candidates[0].profileUrl || (urlIndex.get(candidates[0].profileUrl)?.length ?? 0) !== 1) {
      issues.ambiguousConnectionOrdinals.push(ordinal);
      continue;
    }
    mapped.push({ selection: person, connection: candidates[0] });
  }

  const selectedUrlToMappedIndex = new Map(mapped.map((item, index) => [item.connection.profileUrl, index]));
  const lastContactByMappedIndex = new Map();
  const lastContactMessageRecordsByMappedIndex = new Map();
  const messageCountByMappedIndex = new Map();
  let validMessageDates = 0;
  let invalidMessageDates = 0;
  let emptyMessageDates = 0;
  let messagesTouchingSelectedContacts = 0;

  for (const [messageRowIndex, row] of messageRows.entries()) {
    const dateText = pick(row, "DATE", "Date", "Sent Date");
    const date = parseMessageDate(dateText);
    if (date) validMessageDates += 1;
    else if (dateText) invalidMessageDates += 1;
    else emptyMessageDates += 1;

    const participants = new Set();
    const senderUrl = normalizeLinkedinUrl(pick(row, "SENDER PROFILE URL", "Sender Profile URL"));
    const recipientUrls = extractLinkedinUrls(pick(row, "RECIPIENT PROFILE URLS", "Recipient Profile URLs"));
    const addUrl = (url) => {
      const indexes = urlIndex.get(url) ?? [];
      if (indexes.length > 1) {
        if (selectedUrlToMappedIndex.has(url)) issues.ambiguousSelectedMessageRows += 1;
        return;
      }
      if (indexes.length === 1) participants.add(indexes[0]);
    };

    if (senderUrl) addUrl(senderUrl);
    else for (const participantIndex of resolveExactName(pick(row, "FROM", "From", "Sender"), nameIndex)) participants.add(participantIndex);

    if (recipientUrls.length) {
      for (const url of recipientUrls) addUrl(url);
    } else {
      for (const participantIndex of resolveRecipients(pick(row, "TO", "To", "Recipients"), nameIndex)) participants.add(participantIndex);
    }

    const selectedParticipants = [...participants]
      .map((participantIndex) => selectedUrlToMappedIndex.get(connections[participantIndex].profileUrl))
      .filter((mappedIndex) => mappedIndex !== undefined);
    if (!date && selectedParticipants.length) issues.invalidRelevantMessageDateRows += 1;
    if (!date || selectedParticipants.length === 0) continue;

    messagesTouchingSelectedContacts += 1;
    for (const mappedIndex of new Set(selectedParticipants)) {
      const previous = lastContactByMappedIndex.get(mappedIndex);
      if (!previous || Date.parse(date) > Date.parse(previous)) {
        lastContactByMappedIndex.set(mappedIndex, date);
        lastContactMessageRecordsByMappedIndex.set(mappedIndex, [messageRowIndex + 1]);
      } else if (Date.parse(date) === Date.parse(previous)) {
        lastContactMessageRecordsByMappedIndex.set(mappedIndex, [
          ...(lastContactMessageRecordsByMappedIndex.get(mappedIndex) ?? []),
          messageRowIndex + 1,
        ]);
      }
      messageCountByMappedIndex.set(mappedIndex, (messageCountByMappedIndex.get(mappedIndex) ?? 0) + 1);
    }
  }

  const expectedSelectionCount = 57;
  if (selection.length !== expectedSelectionCount) {
    issues.invalidSelectionOrdinals.push(0);
  }
  const aggregate = {
    expectedSelected: expectedSelectionCount,
    selected: selection.length,
    connectionRows: connections.length,
    matchedConnections: mapped.length,
    missingConnections: issues.missingConnectionOrdinals.length,
    ambiguousConnections: issues.ambiguousConnectionOrdinals.length,
    invalidSelectionRecords: new Set(issues.invalidSelectionOrdinals).size,
    duplicateSelectionRecords: issues.duplicateSelectionOrdinals.length,
    messageRows: messageRows.length,
    validMessageDates,
    invalidMessageDates,
    emptyMessageDates,
    messagesTouchingSelectedContacts,
    selectedContactsWithMessageHistory: lastContactByMappedIndex.size,
    invalidRelevantMessageDateRows: issues.invalidRelevantMessageDateRows,
    ambiguousSelectedMessageRows: issues.ambiguousSelectedMessageRows,
    priorities: summarize(selection, "priority"),
    cadenceDays: summarize(selection, "cadenceDays"),
    outputWritten: false,
  };

  const hasErrors = aggregate.selected !== expectedSelectionCount ||
    aggregate.matchedConnections !== expectedSelectionCount ||
    aggregate.missingConnections > 0 || aggregate.ambiguousConnections > 0 ||
    aggregate.invalidSelectionRecords > 0 || aggregate.duplicateSelectionRecords > 0 ||
    aggregate.invalidRelevantMessageDateRows > 0 || aggregate.ambiguousSelectedMessageRows > 0;
  if (hasErrors) {
    publicSummary({ ...aggregate, issues });
    process.exitCode = 1;
    return;
  }

  const contacts = mapped.map(({ selection: person, connection }, index) => ({
      ordinal: person.ordinal,
      name: person.name,
      priority: person.priority,
      cadenceDays: person.cadenceDays,
      lastContactedAt: lastContactByMappedIndex.get(index) ?? null,
      lastContactMessageRecordNumbers: lastContactMessageRecordsByMappedIndex.get(index) ?? [],
      messageCount: messageCountByMappedIndex.get(index) ?? 0,
      connection: {
        csvRecordNumber: connection.recordNumber,
        profileUrl: connection.profileUrl,
        firstName: connection.firstName,
        lastName: connection.lastName,
        email: connection.email || null,
        company: connection.company || null,
        position: connection.position || null,
        connectedOn: connection.connectedOn || null,
        rowSha256: connectionFingerprint(connection),
      },
    }));

  const output = {
    formatVersion: 1,
    sourceFiles: { connections: "Connections.csv", messages: "messages.csv" },
    connectionsHeaderLine,
    messagesHeaderLine,
    counts: {
      selectedContacts: contacts.length,
      connectionRows: connections.length,
      messageRows: messageRows.length,
      validMessageRows: validMessageDates,
      invalidMessageDates,
      emptyMessageDates,
      contactsWithMessageHistory: contacts.filter((contact) => contact.lastContactedAt).length,
      contactsWithoutMessageHistory: contacts.filter((contact) => !contact.lastContactedAt).length,
      messagesTouchingSelectedContacts,
    },
    contacts,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  aggregate.outputWritten = true;
  publicSummary(aggregate);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
