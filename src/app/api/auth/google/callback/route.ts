import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import {
  clearGoogleOAuthCookies,
  googleNonceCookie,
  googleStateCookie,
  googleVerifierCookie,
  makeSession,
  resolveGoogleUser,
  safeEqual,
  setSessionCookie,
} from "@/lib/auth";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function applicationUrl(path: string) {
  const callback = process.env.GOOGLE_REDIRECT_URI;
  if (!callback) return null;
  try {
    return new URL(path, new URL(callback).origin);
  } catch {
    return null;
  }
}

function loginError(reason: string) {
  const destination = applicationUrl(`/login?error=${encodeURIComponent(reason)}`);
  if (!destination) {
    return NextResponse.json({ error: reason }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const response = NextResponse.redirect(destination);
  clearGoogleOAuthCookies(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("error")) return loginError("google_denied");

  const code = request.nextUrl.searchParams.get("code") ?? "";
  const returnedState = request.nextUrl.searchParams.get("state") ?? "";
  const savedState = request.cookies.get(googleStateCookie)?.value ?? "";
  const verifier = request.cookies.get(googleVerifierCookie)?.value ?? "";
  const nonce = request.cookies.get(googleNonceCookie)?.value ?? "";
  if (!code || !returnedState || !savedState || !safeEqual(returnedState, savedState) || !verifier || !nonce) {
    return loginError("invalid_oauth_response");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callback = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !callback) return loginError("google_not_configured");

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callback,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) return loginError("google_token_exchange_failed");

    const tokens = (await tokenResponse.json()) as { id_token?: unknown };
    if (typeof tokens.id_token !== "string") return loginError("google_identity_missing");

    const { payload } = await jwtVerify(tokens.id_token, googleKeys, {
      algorithms: ["RS256"],
      audience: clientId,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
    });
    if (payload.nonce !== nonce || typeof payload.sub !== "string" || typeof payload.email !== "string" || payload.email_verified !== true) {
      return loginError("google_identity_invalid");
    }

    const userId = await resolveGoogleUser({
      sub: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : payload.email,
      pictureUrl: typeof payload.picture === "string" ? payload.picture : null,
      hostedDomain: typeof payload.hd === "string" ? payload.hd : null,
    });
    const destination = applicationUrl("/");
    if (!destination) return loginError("google_not_configured");
    const response = NextResponse.redirect(destination);
    setSessionCookie(response, await makeSession(userId));
    clearGoogleOAuthCookies(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    return loginError("google_sign_in_failed");
  }
}
