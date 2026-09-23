import { afterAll, describe, expect, it } from "vitest";
import { commitImport, planImport } from "./import";
import { query } from "./db";
import type { Contact } from "./types";

const devUrl = process.env.DEVELOPMENT_DATABASE_URL;
const name = "Integration Test Contact";
const userId = process.env.INTEGRATION_TEST_USER_ID;
describe.skipIf(!devUrl || !userId)("LinkedIn import against a development database", () => {
  if (devUrl) process.env.DATABASE_URL = devUrl;
  afterAll(async () => { await query("DELETE FROM contacts WHERE owner_user_id=$1 AND name=$2", [userId, name]); });
  it("creates once, then fills missing fields without changing personal settings", async () => {
    const row = { name, company: "Test Co", role: "Engineer", linkedin_url: "https://www.linkedin.com/in/networking-crm-integration-test", email: null };
    const first = await commitImport(userId!, planImport([row], []));
    expect(first.created).toBe(1);
    const [saved] = await query<Contact>("SELECT * FROM contacts WHERE owner_user_id=$1 AND name=$2", [userId, name]);
    await query("UPDATE contacts SET company=NULL, priority='high', cadence_days=21, notes='Keep this' WHERE id=$1", [saved.id]);
    const existing = await query<Contact>("SELECT * FROM contacts WHERE owner_user_id=$1 AND id=$2", [userId, saved.id]);
    const second = await commitImport(userId!, planImport([row], existing));
    expect(second.updated).toBe(1);
    const [updated] = await query<Contact>("SELECT * FROM contacts WHERE owner_user_id=$1 AND id=$2", [userId, saved.id]);
    expect(updated).toMatchObject({ company: "Test Co", priority: "high", cadence_days: 21, notes: "Keep this" });
  });
});
