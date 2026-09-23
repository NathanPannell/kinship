import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/auth";
import { createContact, deleteAllContacts, listContacts } from "@/lib/data";
import { failure } from "@/lib/http";
import { deleteAllContactsSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const p = request.nextUrl.searchParams;
    return NextResponse.json({ contacts: await listContacts(userId, { search: p.get("search") ?? "", priority: p.get("priority") ?? "", overdue: p.get("overdue") ?? "", sort: p.get("sort") ?? "" }) });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ contact: await createContact(userId, await request.json()) }, { status: 201 }); }
  catch (error) { return failure(error); }
}
export async function DELETE(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    deleteAllContactsSchema.parse(await request.json());
    return NextResponse.json({ deleted: await deleteAllContacts(userId) });
  } catch (error) { return failure(error); }
}
