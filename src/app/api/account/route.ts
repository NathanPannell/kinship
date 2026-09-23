import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getApiUserId } from "@/lib/auth";
import { query } from "@/lib/db";

export async function DELETE(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (body?.confirmation !== "DELETE MY ACCOUNT") {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }
  await query("DELETE FROM users WHERE id=$1", [userId]);
  const response = NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  clearSessionCookie(response);
  return response;
}
