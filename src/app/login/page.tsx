import LoginClient from "./login-client";
export default function LoginPage() {
  return <LoginClient githubEnabled={!!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)} passwordEnabled={!!process.env.APP_PASSWORD} />;
}
