import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query } from "./db";
import { commitOnboarding } from "./onboarding";

const devUrl = process.env.DEVELOPMENT_DATABASE_URL;
const marker = "codex-onboarding-identity-test";
const urlA = `https://www.linkedin.com/in/${marker}-a`;
const urlB = `https://www.linkedin.com/in/${marker}-b`;
const urlC = `https://www.linkedin.com/in/${marker}-c`;
const emailA = `${marker}-a@example.test`;
const emailB = `${marker}-b@example.test`;

const incoming = (overrides: Partial<Record<string, unknown>> = {}) => ({
  name: "Onboarding identity test",
  company: "Example Co",
  role: "Test contact",
  linkedin_url: urlA,
  email: emailA,
  last_contacted_at: "2026-09-20T20:00:00.000Z",
  priority: "normal",
  cadence_days: 30,
  ...overrides,
});

describe.skipIf(!devUrl)("onboarding identities against a development database", () => {
  if (devUrl) process.env.DATABASE_URL = devUrl;

  beforeAll(async () => {
    await query("DELETE FROM contacts WHERE name LIKE $1", [`${marker}%`]);
    await query(
      `INSERT INTO contacts (name, linkedin_url, email, priority, cadence_days)
       VALUES ($1,$2,$3,'normal',30),($4,$5,$6,'normal',30)`,
      [`${marker}-a`, urlA, emailA, `${marker}-b`, urlB, emailB],
    );
  });

  afterAll(async () => {
    await query("DELETE FROM contacts WHERE name LIKE $1", [`${marker}%`]);
  });

  it("skips a row when its URL and email belong to different contacts", async () => {
    const result = await commitOnboarding({ contacts: [incoming({ linkedin_url: urlB, email: emailA })] });
    expect(result).toMatchObject({ created: 0, updated: 0, duplicatesSkipped: 1, contacts: [] });
  });

  it("updates a resolved contact at most once and preserves its stored URL", async () => {
    const result = await commitOnboarding({ contacts: [
      incoming({ email: null, priority: "high" }),
      incoming({ name: `${marker}-second`, linkedin_url: urlC, email: emailA, priority: "low" }),
    ] });

    expect(result).toMatchObject({ created: 0, updated: 1, duplicatesSkipped: 1 });
    const [saved] = await query<{ linkedin_url: string; priority: string }>(
      "SELECT linkedin_url, priority FROM contacts WHERE email=$1",
      [emailA],
    );
    expect(saved).toMatchObject({ linkedin_url: urlA, priority: "high" });
  });
});
