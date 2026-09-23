import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Password sign-in has been replaced by Google sign-in" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
