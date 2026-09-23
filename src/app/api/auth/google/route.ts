import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { googleNonceCookie, googleStateCookie, googleVerifierCookie, oauthCookieOptions } from "@/lib/auth";

function base64url(value: Buffer) {
  return value.toString("base64url");
}

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const callback = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !callback) return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 503 });

  const state = base64url(randomBytes(32));
  const nonce = base64url(randomBytes(32));
  const verifier = base64url(randomBytes(64));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(googleStateCookie, state, oauthCookieOptions);
  response.cookies.set(googleVerifierCookie, verifier, oauthCookieOptions);
  response.cookies.set(googleNonceCookie, nonce, oauthCookieOptions);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
