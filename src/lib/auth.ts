import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";
import { query } from "@/lib/db";

const cookieName = "networking_crm_session";
const stateCookie = "networking_crm_oauth_state";
export const googleStateCookie = "networking_crm_google_state";
export const googleVerifierCookie = "networking_crm_google_verifier";
export const googleNonceCookie = "networking_crm_google_nonce";
export const legacyOwnerUserId = "00000000-0000-4000-8000-000000000001";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

/** Retained so old route modules still compile. Password sessions are no longer accepted. */
export function passwordIdentity() {
  return `password:${createHash("sha256").update(process.env.APP_PASSWORD ?? "").digest("hex")}`;
}

/** Creates a versioned session for an internal user UUID. */
export async function makeSession(userId: string) {
  return new SignJWT({ sessionVersion: 2 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

async function sessionUserId(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.sessionVersion !== 2 || typeof payload.sub !== "string" || !uuidPattern.test(payload.sub)) return null;
    const rows = await query<{ id: string }>("SELECT id FROM users WHERE id = $1 LIMIT 1", [payload.sub]);
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function validSession(token: string | undefined): Promise<boolean> {
  return (await sessionUserId(token)) !== null;
}

export async function getPageUserId(): Promise<string | null> {
  return sessionUserId((await cookies()).get(cookieName)?.value);
}

export async function requirePageUserId(): Promise<string> {
  const userId = await getPageUserId();
  if (!userId) redirect("/login");
  return userId;
}

export async function getApiUserId(request: NextRequest): Promise<string | null> {
  return sessionUserId(request.cookies.get(cookieName)?.value);
}

export async function getAgentUserId(request: NextRequest): Promise<string | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  const supplied = match?.[1] ?? "";
  if (!supplied.startsWith("kin_") || supplied.length !== 47) return null;

  const hash = createHash("sha256").update(supplied).digest("hex");
  try {
    const rows = await query<{ owner_user_id: string }>(
      "SELECT owner_user_id FROM api_tokens WHERE token_hash = $1 AND revoked_at IS NULL LIMIT 1",
      [hash],
    );
    return rows[0]?.owner_user_id ?? null;
  } catch (error) {
    console.error("API token lookup failed", error);
    return null;
  }
}

export async function isPageAuthenticated() {
  return (await getPageUserId()) !== null;
}

export async function requirePageSession() {
  await requirePageUserId();
}

export async function requireApiSession(request: NextRequest): Promise<NextResponse | null> {
  if (await getApiUserId(request)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function requireAgentToken(request: NextRequest): Promise<NextResponse | null> {
  if (await getAgentUserId(request)) return null;
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer" } },
  );
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  pictureUrl?: string | null;
  hostedDomain?: string | null;
}

export async function resolveGoogleUser(identity: GoogleIdentity): Promise<string> {
  const legacyEmail = process.env.LEGACY_OWNER_EMAIL?.trim().toLowerCase();
  const email = identity.email.trim().toLowerCase();
  const subject = identity.sub.trim();
  if (!subject || !email || !identity.name.trim()) throw new Error("Google identity is incomplete");

  if (legacyEmail && email === legacyEmail) {
    const legacyDomain = legacyEmail.split("@")[1];
    const googleControlsAddress = legacyDomain === "gmail.com" || identity.hostedDomain?.toLowerCase() === legacyDomain;
    if (!googleControlsAddress) throw new Error("Legacy owner identity is not authoritative for the configured email domain");
    const claimed = await query<{ id: string }>(
      `INSERT INTO users (id, google_sub, email, name, picture_url)
       VALUES ($5, $1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
       SET google_sub = EXCLUDED.google_sub,
           email = EXCLUDED.email,
           name = EXCLUDED.name,
           picture_url = EXCLUDED.picture_url,
           updated_at = now()
       WHERE users.google_sub IS NULL OR users.google_sub = EXCLUDED.google_sub
       RETURNING id`,
      [subject, email, identity.name.trim(), identity.pictureUrl ?? null, legacyOwnerUserId],
    );
    if (!claimed[0]) throw new Error("Legacy account is already linked to a different Google identity");
    return claimed[0].id;
  }

  const unclaimedLegacyOwner = await query<{ id: string }>(
    "SELECT id FROM users WHERE id = $1 AND google_sub IS NULL LIMIT 1",
    [legacyOwnerUserId],
  );
  if (unclaimedLegacyOwner[0]) {
    throw new Error("The legacy owner must complete Google sign-in before additional accounts can be created");
  }

  const users = await query<{ id: string }>(
    `INSERT INTO users (google_sub, email, name, picture_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_sub) DO UPDATE
     SET email = EXCLUDED.email,
         name = EXCLUDED.name,
         picture_url = EXCLUDED.picture_url,
         updated_at = now()
     RETURNING id`,
    [subject, email, identity.name.trim(), identity.pictureUrl ?? null],
  );
  if (!users[0]) throw new Error("Unable to create or update the Google user");
  return users[0].id;
}

export function setSessionCookie(response: NextResponse, value: string) {
  response.cookies.set(cookieName, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.delete(cookieName);
}

export const oauthCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60,
};

export function clearGoogleOAuthCookies(response: NextResponse) {
  response.cookies.delete(googleStateCookie);
  response.cookies.delete(googleVerifierCookie);
  response.cookies.delete(googleNonceCookie);
}

export { stateCookie };
