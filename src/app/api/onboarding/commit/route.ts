import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { commitOnboarding } from "@/lib/onboarding";
import { failure } from "@/lib/http";

const maxRequestBytes = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const denied = await requireApiSession(request);
  if (denied) return denied;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxRequestBytes) {
    return NextResponse.json({ error: "The onboarding selection is too large" }, { status: 413 });
  }

  try {
    const bodyText = await request.text();
    if (new TextEncoder().encode(bodyText).byteLength > maxRequestBytes) {
      return NextResponse.json({ error: "The onboarding selection is too large" }, { status: 413 });
    }
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    return NextResponse.json(await commitOnboarding(body));
  } catch (error) {
    return failure(error);
  }
}
