import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "GitHub sign-in has been replaced by Google sign-in" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
