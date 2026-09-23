import { NextRequest, NextResponse } from "next/server";
import { getAgentUserId } from "@/lib/auth";
import { createInteraction } from "@/lib/data";
import { failure } from "@/lib/http";
export async function POST(request: NextRequest) {
  const userId = await getAgentUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer" } });
  try { return NextResponse.json({ interaction: await createInteraction(userId, await request.json()) }, { status: 201 }); }
  catch (error) { return failure(error); }
}
