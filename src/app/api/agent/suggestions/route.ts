import { NextRequest, NextResponse } from "next/server";
import { getAgentUserId } from "@/lib/auth";
import { todaySuggestions } from "@/lib/data";
import { failure } from "@/lib/http";
export async function GET(request: NextRequest) {
  const userId = await getAgentUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer" } });
  try { return NextResponse.json(await todaySuggestions(userId)); }
  catch (error) { return failure(error); }
}
