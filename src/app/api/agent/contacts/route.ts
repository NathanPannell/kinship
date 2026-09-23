import { NextRequest, NextResponse } from "next/server";
import { getAgentUserId } from "@/lib/auth";
import { createContact, listContacts } from "@/lib/data";
import { failure } from "@/lib/http";
import { agentContactCreateSchema } from "@/lib/validation";
export async function GET(request: NextRequest) {
  const userId = await getAgentUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer" } });
  try {
    const p = request.nextUrl.searchParams;
    return NextResponse.json({ contacts: await listContacts(userId, { search: p.get("search") ?? "", priority: p.get("priority") ?? "", overdue: p.get("overdue") ?? "", sort: p.get("sort") ?? "" }) });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  const userId = await getAgentUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer" } });
  try {
    const input = agentContactCreateSchema.parse(await request.json().catch(() => ({})));
    const contact = await createContact(userId, input);
    return NextResponse.json({ contact }, { status: 201, headers: { Location: `/api/agent/contacts/${contact.id}` } });
  } catch (error) { return failure(error); }
}
