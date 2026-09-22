import { NextRequest, NextResponse } from "next/server";
import { requireAgentToken } from "@/lib/auth";
import { createInteraction } from "@/lib/data";
import { failure } from "@/lib/http";
export async function POST(request: NextRequest) {
  const denied = requireAgentToken(request); if (denied) return denied;
  try { return NextResponse.json({ interaction: await createInteraction(await request.json()) }, { status: 201 }); }
  catch (error) { return failure(error); }
}
