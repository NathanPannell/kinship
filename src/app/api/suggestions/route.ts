import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { todaySuggestions } from "@/lib/data";
import { failure } from "@/lib/http";
export async function GET(request: NextRequest) {
  const denied = await requireApiSession(request); if (denied) return denied;
  try { return NextResponse.json(await todaySuggestions()); }
  catch (error) { return failure(error); }
}
