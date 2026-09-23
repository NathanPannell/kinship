import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { deleteContactsBulk, updateContactsBulk } from "@/lib/data";
import { failure } from "@/lib/http";

export async function POST(request: NextRequest) {
  const denied = await requireApiSession(request); if (denied) return denied;
  try { return NextResponse.json({ updated: await updateContactsBulk(await request.json()) }); }
  catch (error) { return failure(error); }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireApiSession(request); if (denied) return denied;
  try { return NextResponse.json({ deleted: await deleteContactsBulk(await request.json()) }); }
  catch (error) { return failure(error); }
}
