import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/auth";
import { createInteraction } from "@/lib/data";
import { failure } from "@/lib/http";
export async function POST(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ interaction: await createInteraction(userId, await request.json()) }, { status: 201 }); }
  catch (error) { return failure(error); }
}
