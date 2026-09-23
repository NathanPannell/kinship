import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAgentToken } from "@/lib/auth";
import { contactById, interactionsFor, updateContact } from "@/lib/data";
import { failure } from "@/lib/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  const denied = await requireAgentToken(request); if (denied) return denied;
  try {
    const id = z.uuid().parse((await context.params).id);
    const contact = await contactById(id);
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ contact, interactions: (await interactionsFor(id)).slice(0, 20) });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireAgentToken(request); if (denied) return denied;
  try {
    const id = z.uuid().parse((await context.params).id);
    const contact = await updateContact(id, await request.json());
    return contact ? NextResponse.json({ contact }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) { return failure(error); }
}
