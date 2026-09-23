import { NextRequest, NextResponse } from "next/server";
import { requireAgentToken } from "@/lib/auth";
import { createContact, listContacts } from "@/lib/data";
import { failure } from "@/lib/http";
import { agentContactCreateSchema } from "@/lib/validation";
export async function GET(request: NextRequest) {
  const denied = await requireAgentToken(request); if (denied) return denied;
  try {
    const p = request.nextUrl.searchParams;
    return NextResponse.json({ contacts: await listContacts({ search: p.get("search") ?? "", priority: p.get("priority") ?? "", overdue: p.get("overdue") ?? "", sort: p.get("sort") ?? "" }) });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  const denied = await requireAgentToken(request); if (denied) return denied;
  try {
    const input = agentContactCreateSchema.parse(await request.json().catch(() => ({})));
    const contact = await createContact(input);
    return NextResponse.json({ contact }, { status: 201, headers: { Location: `/api/agent/contacts/${contact.id}` } });
  } catch (error) { return failure(error); }
}
