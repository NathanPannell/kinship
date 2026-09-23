import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/auth";
import { todaySuggestions } from "@/lib/data";
import { failure } from "@/lib/http";
export async function GET(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await todaySuggestions(userId)); }
  catch (error) { return failure(error); }
}
