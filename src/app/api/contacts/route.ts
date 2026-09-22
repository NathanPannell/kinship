import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { createContact, listContacts } from "@/lib/data";
import { failure } from "@/lib/http";

export async function GET(request: NextRequest) {
  const denied = await requireApiSession(request); if (denied) return denied;
  try {
    const p = request.nextUrl.searchParams;
    return NextResponse.json({ contacts: await listContacts({ search: p.get("search") ?? "", priority: p.get("priority") ?? "", overdue: p.get("overdue") ?? "", sort: p.get("sort") ?? "" }) });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  const denied = await requireApiSession(request); if (denied) return denied;
  try { return NextResponse.json({ contact: await createContact(await request.json()) }, { status: 201 }); }
  catch (error) { return failure(error); }
}
