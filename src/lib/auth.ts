import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";
import { query } from "@/lib/db";

const cookieName = "networking_crm_session";
const stateCookie = "networking_crm_oauth_state";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(value);
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function passwordIdentity() {
  return `password:${createHash("sha256").update(process.env.APP_PASSWORD ?? "").digest("hex")}`;
}

export async function makeSession(identity: string) {
  return new SignJWT({ identity }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret());
}

export async function validSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.identity !== "string") return false;
    if (payload.identity.startsWith("password:")) return !!process.env.APP_PASSWORD && safeEqual(payload.identity, passwordIdentity());
    if (payload.identity.startsWith("github:")) {
      const [, id, login] = payload.identity.split(":");
      if (process.env.ALLOWED_GITHUB_ID) return id === process.env.ALLOWED_GITHUB_ID;
      return !!(process.env.ALLOWED_GITHUB_LOGIN && login?.toLowerCase() === process.env.ALLOWED_GITHUB_LOGIN.toLowerCase());
    }
    return false;
  } catch { return false; }
}

export async function isPageAuthenticated() {
  return validSession((await cookies()).get(cookieName)?.value);
}

export async function requirePageSession() {
  if (!(await isPageAuthenticated())) redirect("/login");
}

export async function requireApiSession(request: NextRequest): Promise<NextResponse | null> {
  if (await validSession(request.cookies.get(cookieName)?.value)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function requireAgentToken(request: NextRequest): Promise<NextResponse | null> {
  const expected = process.env.AGENT_API_TOKEN;
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  const supplied = match?.[1] ?? "";
  if (expected && expected.length >= 32 && safeEqual(supplied, expected)) return null;
  if (supplied.startsWith("kin_") && supplied.length === 47) {
    const hash = createHash("sha256").update(supplied).digest("hex");
    try {
      const rows = await query<{ id: string }>("SELECT id FROM api_tokens WHERE token_hash = $1 AND revoked_at IS NULL LIMIT 1", [hash]);
      if (rows.length) return null;
    } catch (error) {
      console.error("API token lookup failed", error);
      return NextResponse.json({ error: "Token verification unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
}

export function setSessionCookie(response: NextResponse, value: string) {
  response.cookies.set(cookieName, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export function clearSessionCookie(response: NextResponse) { response.cookies.delete(cookieName); }
export { stateCookie };
