import { NextRequest, NextResponse } from "next/server";
import { makeSession, safeEqual, setSessionCookie, stateCookie } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = request.cookies.get(stateCookie)?.value;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!code || !state || !saved || !safeEqual(state, saved) || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }), cache: "no-store",
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  const userResponse = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "networking-crm" }, cache: "no-store",
  });
  const user = await userResponse.json();
  const allowedId = process.env.ALLOWED_GITHUB_ID;
  const allowedLogin = process.env.ALLOWED_GITHUB_LOGIN;
  const allowed = userResponse.ok && (allowedId ? String(user.id) === allowedId : !!(allowedLogin && String(user.login).toLowerCase() === allowedLogin.toLowerCase()));
  if (!allowed) return NextResponse.redirect(new URL("/login?error=account", url.origin));
  const response = NextResponse.redirect(new URL("/", url.origin));
  response.cookies.delete(stateCookie);
  setSessionCookie(response, await makeSession(`github:${user.id}:${user.login}`));
  return response;
}
