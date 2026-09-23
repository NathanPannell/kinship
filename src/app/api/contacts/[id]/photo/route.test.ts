import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({ query: vi.fn(), requireApiSession: vi.fn() }));

vi.mock("@/lib/db", () => ({ query: mocks.query }));
vi.mock("@/lib/auth", () => ({ requireApiSession: mocks.requireApiSession }));

import { DELETE, GET, POST } from "./route";

const contactId = "b342ae0e-690e-4d71-8f68-25e1084a44d3";
const origin = "https://crm.example";
const context = { params: Promise.resolve({ id: contactId }) };

function request(urlPath: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`${origin}${urlPath}`, init);
}

describe("contact photo route", () => {
  let storedImage: Buffer | null;

  beforeEach(() => {
    storedImage = null;
    mocks.requireApiSession.mockReset().mockResolvedValue(null);
    mocks.query.mockReset().mockImplementation(async (statement: string, params: unknown[] = []) => {
      if (statement.includes("INSERT INTO contact_photos")) {
        storedImage = Buffer.from(params[1] as string, "base64");
        return [{ updated_at: "2026-09-23T20:00:00.000Z" }];
      }
      if (statement.includes("encode(image_data, 'base64')")) {
        return storedImage ? [{ image_base64: storedImage.toString("base64"), updated_at: "2026-09-23T20:00:00.000Z" }] : [];
      }
      if (statement.includes("SELECT EXISTS (SELECT 1 FROM contacts")) return [{ exists: true }];
      if (statement.includes("DELETE FROM contact_photos")) {
        storedImage = null;
        return [];
      }
      throw new Error(`Unexpected query: ${statement}`);
    });
  });

  it("uploads a normalized avatar, serves it privately, and deletes it", async () => {
    const jpeg = await sharp({ create: { width: 480, height: 320, channels: 3, background: { r: 120, g: 80, b: 40 } } }).jpeg().toBuffer();
    const form = new FormData();
    form.set("photo", new File([jpeg], "profile.jpg", { type: "image/jpeg" }));
    const uploaded = await POST(request(`/api/contacts/${contactId}/photo`, { method: "POST", headers: { origin }, body: form }), context);

    expect(uploaded.status).toBe(201);
    expect(storedImage).not.toBeNull();
    expect((await sharp(storedImage as Buffer).metadata()).format).toBe("webp");
    expect(mocks.query.mock.calls[0][1][0]).toBe(contactId);

    const served = await GET(request(`/api/contacts/${contactId}/photo`), context);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/webp");
    expect(served.headers.get("cache-control")).toContain("no-store");
    expect((await sharp(Buffer.from(await served.arrayBuffer())).metadata()).format).toBe("webp");

    const removed = await DELETE(request(`/api/contacts/${contactId}/photo`, { method: "DELETE", headers: { origin } }), context);
    expect(removed.status).toBe(200);
    expect(storedImage).toBeNull();
    expect((await GET(request(`/api/contacts/${contactId}/photo`), context)).status).toBe(404);
  });

  it("requires an authenticated session to serve the image", async () => {
    mocks.requireApiSession.mockResolvedValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const response = await GET(request(`/api/contacts/${contactId}/photo`), context);
    expect(response.status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("returns 400 when PNG metadata is readable but decoding the pixels fails", async () => {
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
    const truncatedPng = png.subarray(0, png.length - 20);
    expect((await sharp(truncatedPng, { failOn: "error" }).metadata()).format).toBe("png");
    const form = new FormData();
    form.set("photo", new File([truncatedPng], "profile.png", { type: "image/png" }));

    const response = await POST(request(`/api/contacts/${contactId}/photo`, { method: "POST", headers: { origin }, body: form }), context);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "This image could not be processed. Try another file." });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
