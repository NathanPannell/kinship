import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiUserId } from "@/lib/auth";
import { query } from "@/lib/db";
import { failure } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  try {
    const id = z.uuid().parse((await context.params).id);
    const rows = await query<{ id: string }>("UPDATE api_tokens SET revoked_at = now() WHERE id = $1 AND owner_user_id = $2 AND revoked_at IS NULL RETURNING id", [id, userId]);
    if (!rows.length) return NextResponse.json({ error: "Active token not found" }, { status: 404 });
    return NextResponse.json({ revoked: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
