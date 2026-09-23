import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "../..");
const privateDataDirectory = path.join(projectDirectory, ".codex", "private-data");
const reconcilerPath = path.join(scriptDirectory, "reconcile-selected-contacts.mjs");
const manifestPath = path.join(scriptDirectory, "selected-people.json");
const reconciledPath = path.join(privateDataDirectory, "reconciled-contacts.json");
const maxRequestBytes = 4 * 1024 * 1024;
const expectedCount = 57;
// Keep this strict field list aligned with onboardingContactSchema in src/lib/onboarding.ts.
const expectedContactKeys = [
  "name", "company", "role", "linkedin_url", "email", "last_contacted_at",
  "priority", "cadence_days", "location", "photo_url",
];

class RunnerError extends Error {
  constructor(code, safeMessage, details = {}) {
    super(safeMessage);
    this.name = "RunnerError";
    this.code = code;
    this.details = details;
  }
}

function parseArguments(args) {
  const options = new Map();
  const flags = new Set();
  const booleanOptions = new Set(["--apply", "--dry-run", "--confirm-delete-all", "--help"]);
  const valueOptions = new Set(["--export-dir", "--origin", "--checkpoint"]);

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (booleanOptions.has(argument)) {
      flags.add(argument);
      continue;
    }
    if (!valueOptions.has(argument) || !args[index + 1] || args[index + 1].startsWith("--")) {
      throw new RunnerError("arguments", "Unknown or incomplete command option.");
    }
    options.set(argument, args[index + 1]);
    index += 1;
  }

  if (flags.has("--help")) return { help: true };
  if (flags.has("--apply") && flags.has("--dry-run")) {
    throw new RunnerError("arguments", "Choose either --dry-run or --apply.");
  }
  if (flags.has("--confirm-delete-all") && !flags.has("--apply")) {
    throw new RunnerError("arguments", "--confirm-delete-all can only be used with --apply.");
  }

  const exportDirectory = options.get("--export-dir");
  if (!exportDirectory) {
    throw new RunnerError("arguments", "--export-dir is required.");
  }

  const mode = flags.has("--apply") ? "apply" : "dry-run";
  if (mode === "apply" && !flags.has("--confirm-delete-all")) {
    throw new RunnerError("arguments", "Apply requires both --apply and --confirm-delete-all.");
  }
  return {
    help: false,
    mode,
    exportDirectory: path.resolve(exportDirectory),
    originInput: options.get("--origin") ?? null,
    checkpointInput: options.get("--checkpoint") ?? null,
  };
}

function printUsage() {
  process.stdout.write([
    "Dry run (default):",
    "  node scripts/data/final-setup-runner.mjs --export-dir <directory> [--dry-run]",
    "",
    "Explicit apply:",
    "  APP_PASSWORD=<value> node scripts/data/final-setup-runner.mjs --export-dir <directory> --origin <https://app-origin> --apply --confirm-delete-all [--checkpoint <file-inside-private-data>]",
    "",
    "Dry run validates local files and does not contact the app. Apply saves a local recovery snapshot before deleting contacts.",
  ].join("\n") + "\n");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function validateOrigin(input) {
  if (!input) throw new RunnerError("origin", "--origin is required for apply.");
  let origin;
  try {
    origin = new URL(input);
  } catch {
    throw new RunnerError("origin", "--origin must be a valid app origin URL.");
  }
  if (!(["http:", "https:"].includes(origin.protocol)) || origin.username || origin.password ||
      origin.search || origin.hash || (origin.pathname && origin.pathname !== "/")) {
    throw new RunnerError("origin", "--origin must contain only the app origin, without credentials or a path.");
  }
  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname.toLowerCase());
  if (origin.protocol !== "https:" && !localHost) {
    throw new RunnerError("origin", "Use HTTPS for a non-local app origin.");
  }
  return origin.origin;
}

function runReconciler(exportDirectory) {
  const result = spawnSync(process.execPath, [reconcilerPath, "--export-dir", exportDirectory], {
    cwd: projectDirectory,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) {
    throw new RunnerError("source_validation", "Could not run the local CSV reconciler.");
  }
  if (result.status !== 0) {
    const diagnostic = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new RunnerError("source_validation", diagnostic || "Local CSV validation failed.");
  }
}

function normalizeName(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizeProfileUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
    const pathname = url.pathname.replace(/\/+$/, "");
    return pathname ? `https://www.linkedin.com${pathname}`.toLowerCase() : null;
  } catch {
    return null;
  }
}

function nullableText(value, maxLength) {
  return value === null || (typeof value === "string" && value.length <= maxLength);
}

function validEmail(value) {
  return value === null || (typeof value === "string" && value.length <= 320 &&
    /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value));
}

function isUtcIsoDate(value) {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}

function buildPayload(manifest, reconciled) {
  if (!Array.isArray(manifest) || manifest.length !== expectedCount ||
      reconciled?.contacts?.length !== expectedCount ||
      reconciled?.counts?.selectedContacts !== expectedCount) {
    throw new RunnerError("manifest_count", "The selection and reconciled output must each contain exactly 57 people.");
  }

  const contacts = reconciled.contacts.map((person, index) => {
    const source = manifest[index];
    const connection = person.connection ?? {};
    const sourceName = [connection.firstName, connection.lastName].filter(Boolean).join(" ").trim();
    if (Number(source?.ordinal) !== index + 1 || person.ordinal !== index + 1 ||
        normalizeName(source?.name) !== normalizeName(person.name) ||
        normalizeName(source?.name) !== normalizeName(sourceName) ||
        source?.priority !== person.priority || source?.cadenceDays !== person.cadenceDays) {
      throw new RunnerError("manifest_mismatch", `Manifest and source row disagree at selection record ${index + 1}.`, {
        ordinals: [index + 1],
      });
    }
    return {
      name: sourceName,
      company: connection.company,
      role: connection.position,
      linkedin_url: connection.profileUrl,
      email: connection.email,
      last_contacted_at: person.lastContactedAt,
      priority: person.priority,
      cadence_days: person.cadenceDays,
      location: null,
      photo_url: null,
    };
  });

  const issues = {
    invalidContactOrdinals: [],
    duplicateUrlOrdinals: [],
    duplicateEmailOrdinals: [],
  };
  const seenUrls = new Set();
  const seenEmails = new Set();
  for (const [index, contact] of contacts.entries()) {
    const ordinal = index + 1;
    if (Object.keys(contact).sort().join("|") !== [...expectedContactKeys].sort().join("|") ||
        typeof contact.name !== "string" || contact.name.length < 1 || contact.name.length > 200 ||
        !nullableText(contact.company, 2000) || !nullableText(contact.role, 2000) ||
        !normalizeProfileUrl(contact.linkedin_url) || normalizeProfileUrl(contact.linkedin_url) !== contact.linkedin_url ||
        !validEmail(contact.email) || !isUtcIsoDate(contact.last_contacted_at) ||
        !["high", "normal", "low"].includes(contact.priority) || ![7, 15, 30, 60].includes(contact.cadence_days) ||
        contact.location !== null || contact.photo_url !== null) {
      issues.invalidContactOrdinals.push(ordinal);
    }
    if (seenUrls.has(contact.linkedin_url)) issues.duplicateUrlOrdinals.push(ordinal);
    seenUrls.add(contact.linkedin_url);
    const emailKey = typeof contact.email === "string" ? contact.email.toLowerCase() : null;
    if (emailKey && seenEmails.has(emailKey)) issues.duplicateEmailOrdinals.push(ordinal);
    if (emailKey) seenEmails.add(emailKey);
  }

  if (issues.invalidContactOrdinals.length || issues.duplicateUrlOrdinals.length || issues.duplicateEmailOrdinals.length) {
    throw new RunnerError("payload_validation", "The onboarding payload failed local strict validation.", issues);
  }

  const payload = { contacts };
  const payloadText = JSON.stringify(payload);
  const payloadBytes = Buffer.byteLength(payloadText, "utf8");
  if (payloadBytes > maxRequestBytes) {
    throw new RunnerError("payload_size", "The onboarding payload exceeds the app route size limit.");
  }
  return { payload, payloadText, payloadBytes };
}

async function validateLocalInputs(exportDirectory) {
  runReconciler(exportDirectory);
  const [manifestText, reconciledText] = await Promise.all([
    readFile(manifestPath, "utf8"),
    readFile(reconciledPath, "utf8"),
  ]);
  let manifest;
  let reconciled;
  try {
    manifest = JSON.parse(manifestText);
    reconciled = JSON.parse(reconciledText);
  } catch {
    throw new RunnerError("local_json", "The local manifest or reconciled data is invalid JSON.");
  }
  const prepared = buildPayload(manifest, reconciled);
  return {
    manifest,
    reconciled,
    ...prepared,
    manifestSha256: sha256(manifestText),
    reconciledSha256: sha256(reconciledText),
    payloadSha256: sha256(prepared.payloadText),
  };
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = String(item[key]);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function printSummary(summary) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

function checkpointLocation(input) {
  const time = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultPath = path.join(privateDataDirectory, `final-setup-recovery-${time}.json`);
  const target = path.resolve(projectDirectory, input ?? path.relative(projectDirectory, defaultPath));
  const relative = path.relative(privateDataDirectory, target);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new RunnerError("checkpoint_path", "The recovery checkpoint must be inside .codex/private-data.");
  }
  return target;
}

async function ensureCheckpointAvailable(target) {
  try {
    await access(target);
    throw new RunnerError("checkpoint_exists", "The recovery checkpoint path already exists. Choose a new path.");
  } catch (error) {
    if (error instanceof RunnerError) throw error;
    if (error.code !== "ENOENT") throw new RunnerError("checkpoint_path", "Could not inspect the recovery checkpoint path.");
  }
  await mkdir(path.dirname(target), { recursive: true });
}

async function saveCheckpoint(target, checkpoint, initial = false) {
  const serialized = `${JSON.stringify(checkpoint, null, 2)}\n`;
  if (initial) {
    try {
      await writeFile(target, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
    } catch {
      throw new RunnerError("checkpoint_write", "Could not create the recovery checkpoint before apply.");
    }
    return;
  }

  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, serialized, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, target);
  } catch {
    throw new RunnerError("checkpoint_write", "Could not update the recovery checkpoint.");
  }
}

async function apiJson(origin, pathname, { method = "GET", cookie = null, body = undefined } = {}) {
  const headers = { accept: "application/json" };
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  let response;
  try {
    response = await fetch(`${origin}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new RunnerError("network", `Network request failed for ${method} ${pathname}.`);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== "object") {
    throw new RunnerError("http", `HTTP ${response.status} for ${method} ${pathname}.`, { status: response.status });
  }
  return { result, response };
}

async function createSession(origin, password) {
  const { result, response } = await apiJson(origin, "/api/auth/password", {
    method: "POST",
    body: { password },
  });
  if (result.ok !== true) throw new RunnerError("auth", "App authentication failed. Check APP_PASSWORD and app readiness.");
  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") ?? ""];
  const sessionCookie = setCookies
    .map((value) => value.match(/(?:^|,\s*)networking_crm_session=([^;,]+)/)?.[1])
    .find(Boolean);
  if (!sessionCookie) throw new RunnerError("auth_cookie", "The app did not return a session cookie.");
  return `networking_crm_session=${sessionCookie}`;
}

function contactSnapshotKey(contacts) {
  const fields = [
    "id", "name", "company", "role", "linkedin_url", "email", "phone", "location", "photo_url",
    "priority", "cadence_days", "notes", "last_contacted_at", "imported_last_contacted_at", "snoozed_until", "updated_at",
  ];
  const snapshot = contacts.map((contact) => Object.fromEntries(fields.map((field) => [field, contact[field] ?? null])))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  return sha256(JSON.stringify(snapshot));
}

async function fetchContactList(origin, cookie) {
  const { result } = await apiJson(origin, "/api/contacts", { cookie });
  if (!Array.isArray(result.contacts)) throw new RunnerError("read_api", "The contacts read API returned an invalid response.");
  const seenIds = new Set();
  for (const contact of result.contacts) {
    if (!contact || typeof contact.id !== "string" || seenIds.has(contact.id)) {
      throw new RunnerError("read_api", "The contacts read API returned invalid or duplicate contact ids.");
    }
    seenIds.add(contact.id);
  }
  return result.contacts;
}

function normalizeOptionalDate(value) {
  if (value === null || value === undefined) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? "invalid" : new Date(parsed).toISOString();
}

function verifyFinalState(contacts, expectedContacts) {
  const errors = {
    countMismatch: contacts.length !== expectedCount,
    missingOrdinals: [],
    duplicateActualUrls: 0,
    mismatchedOrdinals: [],
  };
  const expectedByUrl = new Map(expectedContacts.map((contact, index) => [contact.linkedin_url, { contact, ordinal: index + 1 }]));
  const actualByUrl = new Map();
  for (const actual of contacts) {
    const url = normalizeProfileUrl(actual.linkedin_url);
    if (!url) continue;
    if (actualByUrl.has(url)) errors.duplicateActualUrls += 1;
    actualByUrl.set(url, actual);
  }

  for (const [url, expected] of expectedByUrl) {
    const actual = actualByUrl.get(url);
    if (!actual) {
      errors.missingOrdinals.push(expected.ordinal);
      continue;
    }
    const expectedBaseline = normalizeOptionalDate(expected.contact.last_contacted_at);
    const actualBaseline = normalizeOptionalDate(actual.imported_last_contacted_at);
    const actualLast = normalizeOptionalDate(actual.last_contacted_at);
    const metadataMismatch = actual.name !== expected.contact.name ||
      (actual.company ?? null) !== expected.contact.company ||
      (actual.role ?? null) !== expected.contact.role ||
      (actual.email ?? null)?.toLowerCase() !== (expected.contact.email ?? null)?.toLowerCase() ||
      actual.priority !== expected.contact.priority ||
      actual.cadence_days !== expected.contact.cadence_days ||
      actualBaseline !== expectedBaseline || actualLast !== expectedBaseline ||
      !Object.hasOwn(actual, "imported_last_contacted_at") ||
      actual.latest_interaction !== null;
    if (metadataMismatch) errors.mismatchedOrdinals.push(expected.ordinal);
  }

  const matchedExpectedUrls = new Set([...expectedByUrl.keys()].filter((url) => actualByUrl.has(url)));
  const unexpectedContacts = contacts.filter((contact) => !matchedExpectedUrls.has(normalizeProfileUrl(contact.linkedin_url))).length;
  return {
    passed: !errors.countMismatch && errors.missingOrdinals.length === 0 && errors.duplicateActualUrls === 0 &&
      errors.mismatchedOrdinals.length === 0 && unexpectedContacts === 0,
    actualCount: contacts.length,
    expectedCount,
    unexpectedContacts,
    errors,
  };
}

async function applySetup({ origin, password, checkpointPath: target, local }) {
  await ensureCheckpointAvailable(target);
  let stage = "preflight_complete";
  const checkpoint = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    origin,
    stage,
    expectedContacts: expectedCount,
    sourceManifestSha256: local.manifestSha256,
    reconciledDataSha256: local.reconciledSha256,
    onboardingPayloadSha256: local.payloadSha256,
    onboardingPayloadBytes: local.payloadBytes,
    priorState: null,
    deleteResult: null,
    commitResult: null,
    verification: null,
    failure: null,
  };
  await saveCheckpoint(target, checkpoint, true);

  try {
    stage = "authentication_requested";
    checkpoint.stage = stage;
    await saveCheckpoint(target, checkpoint);
    const cookie = await createSession(origin, password);
    stage = "authenticated";
    checkpoint.stage = stage;
    await saveCheckpoint(target, checkpoint);

    stage = "snapshot_read_requested";
    checkpoint.stage = stage;
    await saveCheckpoint(target, checkpoint);
    const initialContacts = await fetchContactList(origin, cookie);
    const priorState = [];
    let priorInteractionCount = 0;
    for (const contact of initialContacts) {
      const { result } = await apiJson(origin, `/api/contacts/${encodeURIComponent(contact.id)}`, { cookie });
      if (result.contact?.id !== contact.id || !Array.isArray(result.interactions)) {
        throw new RunnerError("snapshot", "A contact detail response did not match the initial read snapshot.");
      }
      priorInteractionCount += result.interactions.length;
      priorState.push({ contact: result.contact, interactions: result.interactions });
    }
    const contactsAfterSnapshot = await fetchContactList(origin, cookie);
    if (contactSnapshotKey(initialContacts) !== contactSnapshotKey(contactsAfterSnapshot)) {
      throw new RunnerError("snapshot_changed", "The app data changed during the recovery snapshot. No contacts were deleted.");
    }
    checkpoint.priorState = priorState;
    checkpoint.priorCounts = { contacts: priorState.length, interactions: priorInteractionCount };
    stage = "recovery_snapshot_saved";
    checkpoint.stage = stage;
    await saveCheckpoint(target, checkpoint);

    stage = "delete_requested";
    checkpoint.stage = stage;
    await saveCheckpoint(target, checkpoint);
    let deleted;
    try {
      const { result } = await apiJson(origin, "/api/contacts", {
        method: "DELETE",
        cookie,
        body: { confirmation: "DELETE_ALL_CONTACTS" },
      });
      deleted = result.deleted;
      if (!Number.isInteger(deleted) || deleted < 0) {
        throw new RunnerError("delete_response", "The delete route returned an invalid count.");
      }
    } catch (error) {
      stage = error instanceof RunnerError && error.code === "http" ? "delete_request_failed" : "delete_outcome_unknown";
      checkpoint.stage = stage;
      checkpoint.failure = { stage, code: error.code ?? "unknown", at: new Date().toISOString() };
      await saveCheckpoint(target, checkpoint);
      throw error;
    }
    checkpoint.deleteResult = { deleted };
    stage = "contacts_deleted";
    checkpoint.stage = stage;
    await saveCheckpoint(target, checkpoint);
    if (deleted !== initialContacts.length) {
      stage = "delete_count_mismatch";
      checkpoint.stage = stage;
      checkpoint.failure = { stage, code: "count_mismatch", at: new Date().toISOString() };
      await saveCheckpoint(target, checkpoint);
      throw new RunnerError("delete_count_mismatch", "The delete count differed from the recovery snapshot. Stopped before onboarding commit.");
    }

    stage = "post_delete_read_requested";
    checkpoint.stage = stage;
    await saveCheckpoint(target, checkpoint);
    const emptyContacts = await fetchContactList(origin, cookie);
    if (emptyContacts.length !== 0) {
      stage = "contacts_remain_after_delete";
      checkpoint.stage = stage;
      checkpoint.failure = { stage, code: "not_empty", at: new Date().toISOString() };
      await saveCheckpoint(target, checkpoint);
      throw new RunnerError("post_delete_state", "The contacts API was not empty after delete. Stopped before onboarding commit.");
    }
    stage = "contacts_deleted_verified";
    checkpoint.stage = stage;
    await saveCheckpoint(target, checkpoint);

    stage = "onboarding_commit_requested";
    checkpoint.stage = stage;
    await saveCheckpoint(target, checkpoint);
    let commitResult;
    try {
      const { result } = await apiJson(origin, "/api/onboarding/commit", {
        method: "POST",
        cookie,
        body: local.payload,
      });
      commitResult = result;
    } catch (error) {
      stage = error instanceof RunnerError && error.code === "http" ? "onboarding_commit_failed" : "onboarding_commit_outcome_unknown";
      checkpoint.stage = stage;
      checkpoint.failure = { stage, code: error.code ?? "unknown", at: new Date().toISOString() };
      await saveCheckpoint(target, checkpoint);
      throw error;
    }
    checkpoint.commitResult = {
      created: commitResult.created,
      updated: commitResult.updated,
      duplicatesSkipped: commitResult.duplicatesSkipped,
      resolvedContacts: Array.isArray(commitResult.contacts) ? commitResult.contacts.length : null,
    };
    stage = "onboarding_committed";
    checkpoint.stage = stage;
    await saveCheckpoint(target, checkpoint);

    stage = "verification_read_requested";
    checkpoint.stage = stage;
    await saveCheckpoint(target, checkpoint);
    const finalContacts = await fetchContactList(origin, cookie);
    const verification = verifyFinalState(finalContacts, local.payload.contacts);
    checkpoint.verification = verification;
    const expectedCommitSummary = commitResult.created === expectedCount && commitResult.updated === 0 &&
      commitResult.duplicatesSkipped === 0 && Array.isArray(commitResult.contacts) && commitResult.contacts.length === expectedCount;
    if (!verification.passed || !expectedCommitSummary) {
      stage = "verification_failed";
      checkpoint.stage = stage;
      checkpoint.failure = { stage, code: "post_commit_mismatch", at: new Date().toISOString() };
      await saveCheckpoint(target, checkpoint);
      throw new RunnerError("verification_failed", "The app state did not match the 57-person payload. Recovery snapshot is available.", {
        verification,
      });
    }

    stage = "verified";
    checkpoint.stage = stage;
    checkpoint.verifiedAt = new Date().toISOString();
    await saveCheckpoint(target, checkpoint);
    return {
      ok: true,
      mode: "apply",
      stage,
      selectedContacts: expectedCount,
      priorContacts: priorState.length,
      priorInteractions: priorInteractionCount,
      deletedContacts: deleted,
      createdContacts: commitResult.created,
      updatedContacts: commitResult.updated,
      duplicatesSkipped: commitResult.duplicatesSkipped,
      verifiedContacts: verification.actualCount,
      contactsWithBaseline: local.reconciled.counts.contactsWithMessageHistory,
      recoveryCheckpoint: path.relative(projectDirectory, target),
    };
  } catch (error) {
    if (!checkpoint.failure) {
      checkpoint.stage = stage;
      checkpoint.failure = { stage, code: error.code ?? "unknown", at: new Date().toISOString() };
      await saveCheckpoint(target, checkpoint).catch(() => {});
    }
    throw new RunnerError("apply_failed", "Apply stopped. Inspect the recovery checkpoint and app state before retrying.", {
      stage,
      checkpointPath: path.relative(projectDirectory, target),
      causeCode: error.code ?? "unknown",
      details: error.details ?? {},
    });
  }
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    printUsage();
    return;
  }

  let currentStage = "local_validation";
  let checkpointPath = null;
  try {
    const local = await validateLocalInputs(options.exportDirectory);
    const priorities = countBy(local.manifest, "priority");
    const cadenceDays = countBy(local.manifest, "cadenceDays");
    if (options.mode === "dry-run") {
      if (options.originInput) validateOrigin(options.originInput);
      printSummary({
        ok: true,
        mode: "dry-run",
        networkCalls: 0,
        databaseMutations: 0,
        selectedContacts: expectedCount,
        sourceConnectionRows: local.reconciled.counts.connectionRows,
        sourceMessageRows: local.reconciled.counts.messageRows,
        messagesTouchingSelectedContacts: local.reconciled.counts.messagesTouchingSelectedContacts,
        contactsWithBaseline: local.reconciled.counts.contactsWithMessageHistory,
        contactsWithoutBaseline: local.reconciled.counts.contactsWithoutMessageHistory,
        priorities,
        cadenceDays,
        onboardingPayloadBytes: local.payloadBytes,
        onboardingPayloadSha256: local.payloadSha256,
        plannedEndpoints: ["DELETE /api/contacts", "POST /api/onboarding/commit", "GET /api/contacts"],
      });
      return;
    }

    currentStage = "apply_preflight";
    const origin = validateOrigin(options.originInput);
    const password = process.env.APP_PASSWORD;
    if (!password || password.length < 16) {
      throw new RunnerError("password", "APP_PASSWORD must be set and meet the app password length requirement.");
    }
    checkpointPath = checkpointLocation(options.checkpointInput);
    const summary = await applySetup({
      origin,
      password,
      checkpointPath,
      local,
    });
    printSummary({
      ...summary,
      contactsWithBaseline: local.reconciled.counts.contactsWithMessageHistory,
      contactsWithoutBaseline: local.reconciled.counts.contactsWithoutMessageHistory,
    });
  } catch (error) {
    const report = {
      ok: false,
      mode: options.mode,
      failureStage: error.details?.stage ?? currentStage,
      error: error.message,
    };
    if (error.details?.checkpointPath) report.recoveryCheckpoint = error.details.checkpointPath;
    if (error.details?.verification) {
      report.verification = {
        passed: error.details.verification.passed,
        actualCount: error.details.verification.actualCount,
        expectedCount: error.details.verification.expectedCount,
        unexpectedContacts: error.details.verification.unexpectedContacts,
        errors: error.details.verification.errors,
      };
    }
    process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 1;
  }
}

main();
