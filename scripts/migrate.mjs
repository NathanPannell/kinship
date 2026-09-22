import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL_UNPOOLED or DATABASE_URL");
const client = new Client({ connectionString: url });
await client.connect();
try {
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const directory = join(process.cwd(), "database", "migrations");
  for (const file of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
    const applied = await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [file]);
    if (applied.rowCount) continue;
    await client.query("BEGIN");
    try {
      await client.query(await readFile(join(directory, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
} finally { await client.end(); }
