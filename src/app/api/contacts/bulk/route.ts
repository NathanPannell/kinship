import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/auth";
import { deleteContactsBulk, updateContactsBulk } from "@/lib/data";
import { failure } from "@/lib/http";

export async function POST(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ updated: await updateContactsBulk(userId, await request.json()) }); }
  catch (error) { return failure(error); }
}

export async function DELETE(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ deleted: await deleteContactsBulk(userId, await request.json()) }); }
  catch (error) { return failure(error); }
}
