import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiUserId } from "@/lib/auth";
import { snoozeContact } from "@/lib/data";
import { failure } from "@/lib/http";
const schema = z.object({ contact_id: z.uuid(), days: z.coerce.number().int().min(1).max(365).default(7) });
export async function POST(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { contact_id, days } = schema.parse(await request.json());
    const contact = await snoozeContact(userId, contact_id, days);
    return contact ? NextResponse.json({ contact }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) { return failure(error); }
}
