import { NextResponse } from "next/server";
import { query } from "@/lib/db";
export async function GET() {
  try {
    const migrations = await query<{ name: string }>("SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1");
    return NextResponse.json({ ready: migrations.length > 0, migration: migrations[0]?.name ?? null, revision: process.env.APP_REVISION ?? null }, { status: migrations.length ? 200 : 503 });
  } catch { return NextResponse.json({ ready: false }, { status: 503 }); }
}
