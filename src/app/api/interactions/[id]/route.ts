import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiUserId } from "@/lib/auth";
import { deleteInteraction, updateInteraction } from "@/lib/data";
import { failure } from "@/lib/http";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const interaction = await updateInteraction(userId, z.uuid().parse((await context.params).id), await request.json());
    return interaction ? NextResponse.json({ interaction }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: NextRequest, context: Context) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ deleted: await deleteInteraction(userId, z.uuid().parse((await context.params).id)) }); }
  catch (error) { return failure(error); }
}
