import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { stateCookie } from "@/lib/auth";

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "GitHub sign-in is not configured" }, { status: 503 });
  const state = randomBytes(24).toString("hex");
  const origin = new URL(request.url).origin;
  const destination = new URL("https://github.com/login/oauth/authorize");
  destination.searchParams.set("client_id", clientId);
  destination.searchParams.set("redirect_uri", `${origin}/api/auth/github/callback`);
  destination.searchParams.set("state", state);
  const response = NextResponse.redirect(destination);
  response.cookies.set(stateCookie, state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
