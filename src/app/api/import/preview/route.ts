import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/auth";
import { allContacts } from "@/lib/data";
import { parseConnections, planImport } from "@/lib/import";
import { failure } from "@/lib/http";
export async function POST(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size > 4_000_000) return NextResponse.json({ error: "Choose a CSV under 4 MB" }, { status: 400 });
    const plan = planImport(parseConnections(await file.text()), await allContacts(userId));
    return NextResponse.json({ create: plan.create.length, update: plan.update.length, skipped: plan.skipped.length, preview: [...plan.create, ...plan.update].slice(0, 10) });
  } catch (error) { return failure(error); }
}
