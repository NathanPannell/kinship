import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/db", () => ({ query }));

import { getApiUserId, makeSession, resolveGoogleUser } from "./auth";
import { createInteraction, deleteContactsBulk, deleteInteraction, interactionsFor, updateInteraction } from "./data";
import { GET as getContact, PATCH as patchContact } from "@/app/api/contacts/[id]/route";
import { GET as getPhoto, POST as uploadPhoto, DELETE as deletePhoto } from "@/app/api/contacts/[id]/photo/route";
import { PATCH as patchInteraction, DELETE as deleteInteractionRoute } from "@/app/api/interactions/[id]/route";
import { GET as getTokens } from "@/app/api/tokens/route";
import { DELETE as revokeToken } from "@/app/api/tokens/[id]/route";

const ownerA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ownerB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const contactB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const interactionB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const tokenB = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const origin = "https://kinship.example";

async function ownerARequest(path: string, method = "GET", body?: unknown) {
  return new NextRequest(`${origin}${path}`, {
    method,
    headers: {
      cookie: `networking_crm_session=${await makeSession(ownerA)}`,
      ...(method !== "GET" ? { origin } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function onlyOwnerAUserExists(statement: string, params: unknown[]) {
  if (statement.includes("SELECT id FROM users WHERE id = $1")) return params[0] === ownerA ? [{ id: ownerA }] : [];
  return [];
}

function assertOwnerScoped(statement: string, params: unknown[]) {
  expect(params).toContain(ownerA);
  expect(statement).toMatch(/owner_user_id\s*=\s*\$\d/);
}

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "s".repeat(48));
  vi.stubEnv("LEGACY_OWNER_EMAIL", "legacy@example.com");
  query.mockReset().mockImplementation(onlyOwnerAUserExists);
});

describe("owner A cannot access owner B records", () => {
  it("keeps contact reads and updates behind both the session and owner predicate", async () => {
    const context = { params: Promise.resolve({ id: contactB }) };
    const get = await getContact(await ownerARequest(`/api/contacts/${contactB}`), context);
    expect(get.status).toBe(404);
    const patch = await patchContact(await ownerARequest(`/api/contacts/${contactB}`, "PATCH", { name: "Changed" }), context);
    expect(patch.status).toBe(404);
    expect(query.mock.calls.filter(([sql]) => !sql.includes("SELECT id FROM users"))).toHaveLength(2);
    for (const [sql, params] of query.mock.calls.filter(([sql]) => !sql.includes("SELECT id FROM users"))) {
      assertOwnerScoped(sql, params);
      expect(params).toContain(contactB);
    }
  });

  it("scopes interaction reads, creation, updates, and deletion through contact ownership", async () => {
    expect(await interactionsFor(ownerA, contactB)).toEqual([]);
    await expect(createInteraction(ownerA, { contact_id: contactB, channel: "Email", note: "No access" }))
      .rejects.toMatchObject({ code: "23503" });
    expect(await updateInteraction(ownerA, interactionB, { note: "No access" })).toBeNull();
    expect(await deleteInteraction(ownerA, interactionB)).toBe(false);

    const context = { params: Promise.resolve({ id: interactionB }) };
    expect((await patchInteraction(await ownerARequest(`/api/interactions/${interactionB}`, "PATCH", { note: "No access" }), context)).status).toBe(404);
    const deleted = await deleteInteractionRoute(await ownerARequest(`/api/interactions/${interactionB}`, "DELETE"), context);
    expect(await deleted.json()).toEqual({ deleted: false });

    const statements = query.mock.calls.filter(([sql]) => !sql.includes("SELECT id FROM users"));
    expect(statements).toHaveLength(6);
    for (const [sql, params] of statements) assertOwnerScoped(sql, params);
    expect(statements[0][0]).toContain("INNER JOIN contacts c");
    expect(statements[1][0]).toContain("SELECT c.id");
    for (const [sql] of statements.slice(2)) expect(sql).toContain("EXISTS (");
  });

  it("denies photo reads and deletion for another owner's contact", async () => {
    const context = { params: Promise.resolve({ id: contactB }) };
    expect((await getPhoto(await ownerARequest(`/api/contacts/${contactB}/photo`), context)).status).toBe(404);
    expect((await deletePhoto(await ownerARequest(`/api/contacts/${contactB}/photo`, "DELETE"), context)).status).toBe(404);
    const statements = query.mock.calls.filter(([sql]) => !sql.includes("SELECT id FROM users"));
    expect(statements).toHaveLength(2);
    for (const [sql, params] of statements) {
      assertOwnerScoped(sql, params);
      expect(params).toContain(contactB);
    }
  });

  it("denies photo replacement for another owner's contact", async () => {
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    const form = new FormData();
    form.set("photo", new File([image], "photo.png", { type: "image/png" }));
    const request = await ownerARequest(`/api/contacts/${contactB}/photo`, "POST");
    const upload = await uploadPhoto(new NextRequest(request.url, {
      method: "POST",
      headers: { cookie: request.headers.get("cookie")!, origin },
      body: form,
    }), { params: Promise.resolve({ id: contactB }) });
    expect(upload.status).toBe(404);
    const [sql, params] = query.mock.calls.find(([statement]) => statement.includes("INSERT INTO contact_photos"))!;
    assertOwnerScoped(sql, params);
    expect(sql).toContain("WHERE EXISTS (SELECT 1 FROM contacts");
    expect(params[0]).toBe(contactB);
  });

  it("cannot bulk delete another owner's contact", async () => {
    query.mockImplementation((statement: string, params: unknown[]) => {
      if (statement.includes("WITH deleted AS")) return [{ count: 0 }];
      return onlyOwnerAUserExists(statement, params);
    });
    expect(await deleteContactsBulk(ownerA, { ids: [contactB] })).toBe(0);
    const [sql, params] = query.mock.calls[0];
    assertOwnerScoped(sql, params);
    expect(params).toEqual([ownerA, [contactB]]);
  });

  it("lists only owner A tokens and refuses to revoke owner B's token", async () => {
    const listed = await getTokens(await ownerARequest("/api/tokens"));
    expect(await listed.json()).toEqual({ tokens: [] });
    const context = { params: Promise.resolve({ id: tokenB }) };
    expect((await revokeToken(await ownerARequest(`/api/tokens/${tokenB}`, "DELETE"), context)).status).toBe(404);
    const statements = query.mock.calls.filter(([sql]) => !sql.includes("SELECT id FROM users"));
    expect(statements).toHaveLength(2);
    for (const [sql, params] of statements) assertOwnerScoped(sql, params);
    expect(statements[1][1]).toEqual([tokenB, ownerA]);
  });
});

describe("identity separation", () => {
  it("creates distinct users for distinct Google subjects even when email matches", async () => {
    const users = new Map<string, string>();
    query.mockImplementation((statement: string, params: unknown[]) => {
      if (statement.includes("google_sub IS NULL LIMIT 1")) return [];
      expect(statement).toContain("ON CONFLICT (google_sub)");
      const sub = params[0] as string;
      if (!users.has(sub)) users.set(sub, sub === "google-a" ? ownerA : ownerB);
      return [{ id: users.get(sub) }];
    });
    const identity = { email: "same@example.com", name: "Same Name" };
    expect(await resolveGoogleUser({ ...identity, sub: "google-a" })).toBe(ownerA);
    expect(await resolveGoogleUser({ ...identity, sub: "google-b" })).toBe(ownerB);
    expect(await resolveGoogleUser({ ...identity, sub: "google-a" })).toBe(ownerA);
    expect(users.size).toBe(2);
  });

  it("resolves owner B's session to B even when owner A also exists", async () => {
    query.mockImplementation((statement: string, params: unknown[]) => {
      if (statement.includes("SELECT id FROM users WHERE id = $1")) return [{ id: params[0] }];
      return [];
    });
    const request = new NextRequest(`${origin}/api/contacts`, {
      headers: { cookie: `networking_crm_session=${await makeSession(ownerB)}` },
    });
    expect(await getApiUserId(request)).toBe(ownerB);
    expect(query.mock.calls[0][1]).toEqual([ownerB]);
  });
});
