import { NextRequest, NextResponse } from "next/server";
import { requireAgentToken } from "@/lib/auth";
import { todaySuggestions } from "@/lib/data";
import { failure } from "@/lib/http";
export async function GET(request: NextRequest) {
  const denied = requireAgentToken(request); if (denied) return denied;
  try { return NextResponse.json(await todaySuggestions()); }
  catch (error) { return failure(error); }
}
