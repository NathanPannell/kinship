import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function failure(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
  if (typeof error === "object" && error && "code" in error && error.code === "23505") return NextResponse.json({ error: "A contact with this LinkedIn URL already exists" }, { status: 409 });
  if (typeof error === "object" && error && "code" in error && error.code === "23503") return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  console.error(error);
  return NextResponse.json({ error: "Server error" }, { status: 500 });
}
