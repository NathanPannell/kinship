import { NextRequest, NextResponse } from "next/server";
import { requireAgentToken } from "@/lib/auth";
import { listContacts } from "@/lib/data";
import { failure } from "@/lib/http";
export async function GET(request: NextRequest) {
  const denied = requireAgentToken(request); if (denied) return denied;
  try {
    const p = request.nextUrl.searchParams;
    return NextResponse.json({ contacts: await listContacts({ search: p.get("search") ?? "", priority: p.get("priority") ?? "", overdue: p.get("overdue") ?? "", sort: p.get("sort") ?? "" }) });
  } catch (error) { return failure(error); }
}
