import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  clearSessionCookie(response);
  return response;
}
