import { neon } from "@neondatabase/serverless";

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

export async function query<T>(statement: string, params: unknown[] = []): Promise<T[]> {
  const rows = await db().query(statement, params);
  // Neon decodes timestamptz columns as Date objects; keep one JSON-safe shape
  // for server components, route handlers, and the recommendation module.
  return JSON.parse(JSON.stringify(rows)) as T[];
}
