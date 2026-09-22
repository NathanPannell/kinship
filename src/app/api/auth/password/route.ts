import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { makeSession, passwordIdentity, safeEqual, setSessionCookie } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const expected = process.env.APP_PASSWORD;
  const { password } = await request.json().catch(() => ({}));
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const hash = createHash("sha256").update(ip).digest("hex");
  const [attempt] = await query<{ attempts: number }>(
    `INSERT INTO login_attempts (ip_hash, attempts) VALUES ($1, 1)
     ON CONFLICT (ip_hash) DO UPDATE SET
       attempts=CASE WHEN login_attempts.first_attempt_at < now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
       first_attempt_at=CASE WHEN login_attempts.first_attempt_at < now()-interval '15 minutes' THEN now() ELSE login_attempts.first_attempt_at END
     RETURNING attempts`, [hash],
  );
  if (attempt.attempts > 10) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  if (!expected || expected.length < 16 || typeof password !== "string" || !safeEqual(password, expected)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  await query("DELETE FROM login_attempts WHERE ip_hash=$1", [hash]);
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, await makeSession(passwordIdentity()));
  return response;
}
