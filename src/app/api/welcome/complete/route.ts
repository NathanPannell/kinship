import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/auth";
import { query } from "@/lib/db";
import { failure } from "@/lib/http";

export async function POST(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  try {
    await query(
      "UPDATE users SET welcome_completed_at = COALESCE(welcome_completed_at, now()) WHERE id = $1",
      [userId],
    );
    return NextResponse.json({ completed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
