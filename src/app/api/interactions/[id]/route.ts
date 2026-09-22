import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { deleteInteraction, updateInteraction } from "@/lib/data";
import { failure } from "@/lib/http";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireApiSession(request); if (denied) return denied;
  try {
    const interaction = await updateInteraction(z.uuid().parse((await context.params).id), await request.json());
    return interaction ? NextResponse.json({ interaction }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: NextRequest, context: Context) {
  const denied = await requireApiSession(request); if (denied) return denied;
  try { return NextResponse.json({ deleted: await deleteInteraction(z.uuid().parse((await context.params).id)) }); }
  catch (error) { return failure(error); }
}
