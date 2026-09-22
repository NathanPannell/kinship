import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { snoozeContact } from "@/lib/data";
import { failure } from "@/lib/http";
const schema = z.object({ contact_id: z.uuid(), days: z.coerce.number().int().min(1).max(365).default(7) });
export async function POST(request: NextRequest) {
  const denied = await requireApiSession(request); if (denied) return denied;
  try {
    const { contact_id, days } = schema.parse(await request.json());
    const contact = await snoozeContact(contact_id, days);
    return contact ? NextResponse.json({ contact }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) { return failure(error); }
}
