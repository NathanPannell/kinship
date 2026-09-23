import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ApiDocsScreen } from "@/components/api-docs-screen";
import { requirePageSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "API · Kinship",
  description: "Agent API reference and request playground for Kinship.",
};

export default async function ApiDocsPage() {
  await requirePageSession();
  return <AppShell><ApiDocsScreen /></AppShell>;
}
