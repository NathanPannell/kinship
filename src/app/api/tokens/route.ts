import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiUserId } from "@/lib/auth";
import { query } from "@/lib/db";
import { failure } from "@/lib/http";

const nameSchema = z.object({ name: z.string().trim().min(1).max(80) });
type TokenRow = { id: string; name: string; token_prefix: string; created_at: string; revoked_at: string | null };

function noStore<T>(body: T, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return noStore({ error: "Unauthorized" }, 401);
  try {
    const tokens = await query<TokenRow>("SELECT id, name, token_prefix, created_at, revoked_at FROM api_tokens WHERE owner_user_id=$1 ORDER BY created_at DESC", [userId]);
    return noStore({ tokens });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return noStore({ error: "Unauthorized" }, 401);
  if (request.headers.get("origin") !== request.nextUrl.origin) return noStore({ error: "Invalid request origin" }, 403);
  try {
    const { name } = nameSchema.parse(await request.json());
    const token = `kin_${randomBytes(32).toString("base64url")}`;
    const hash = createHash("sha256").update(token).digest("hex");
    const [row] = await query<TokenRow>(
      "INSERT INTO api_tokens (owner_user_id, name, token_hash, token_prefix) VALUES ($1, $2, $3, $4) RETURNING id, name, token_prefix, created_at, revoked_at",
      [userId, name, hash, `${token.slice(0, 12)}…`],
    );
    return noStore({ token, record: row }, 201);
  } catch (error) { return failure(error); }
}
