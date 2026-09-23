import { NextRequest, NextResponse } from "next/server";
import { getApiUserId } from "@/lib/auth";
import { ContactPhotoError, maxContactPhotoUploadBytes, prepareContactPhoto } from "@/lib/contact-photo";
import { query } from "@/lib/db";
import { failure } from "@/lib/http";
import { z } from "zod";

export const runtime = "nodejs";

type PhotoRow = { image_base64: string; updated_at: string };
type Context = { params: Promise<{ id: string }> };

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

function isSameOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}

async function contactIdFrom(context: Context) {
  const { id } = await context.params;
  return z.uuid().parse(id);
}

export async function GET(request: NextRequest, context: Context) {
  const userId = await getApiUserId(request);
  if (!userId) return privateJson({ error: "Unauthorized" }, 401);
  try {
    const id = await contactIdFrom(context);
    const [photo] = await query<PhotoRow>(
      `SELECT encode(p.image_data, 'base64') AS image_base64, p.updated_at
       FROM contact_photos p JOIN contacts c ON c.id=p.contact_id
       WHERE p.contact_id=$1 AND c.owner_user_id=$2`,
      [id, userId],
    );
    if (!photo) return privateJson({ error: "Photo not found" }, 404);

    const bytes = Buffer.from(photo.image_base64, "base64");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  const userId = await getApiUserId(request);
  if (!userId) return privateJson({ error: "Unauthorized" }, 401);
  if (!isSameOrigin(request)) return privateJson({ error: "Invalid request origin" }, 403);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxContactPhotoUploadBytes + 100_000) {
    return privateJson({ error: "Choose an image no larger than 4 MB." }, 413);
  }

  try {
    const id = await contactIdFrom(context);
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) return privateJson({ error: "Choose a photo to upload." }, 400);
    if (!file.size) return privateJson({ error: "Choose an image file that contains data." }, 400);
    if (file.size > maxContactPhotoUploadBytes) {
      return privateJson({ error: "Choose an image no larger than 4 MB." }, 413);
    }

    const image = await prepareContactPhoto(new Uint8Array(await file.arrayBuffer()), file.type);
    const [saved] = await query<{ updated_at: string }>(
      `INSERT INTO contact_photos (contact_id, image_data, mime_type, byte_size)
       SELECT $1, decode($2, 'base64'), 'image/webp', octet_length(decode($2, 'base64'))
       WHERE EXISTS (SELECT 1 FROM contacts WHERE id=$1 AND owner_user_id=$3)
       ON CONFLICT (contact_id) DO UPDATE
         SET image_data=EXCLUDED.image_data, mime_type=EXCLUDED.mime_type,
             byte_size=EXCLUDED.byte_size, updated_at=now()
       RETURNING updated_at`,
      [id, image.toString("base64"), userId],
    );
    if (!saved) return privateJson({ error: "Person not found" }, 404);
    return privateJson({ uploaded_photo_updated_at: saved.updated_at }, 201);
  } catch (error) {
    if (error instanceof ContactPhotoError) return privateJson({ error: error.message }, error.status);
    return failure(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const userId = await getApiUserId(request);
  if (!userId) return privateJson({ error: "Unauthorized" }, 401);
  if (!isSameOrigin(request)) return privateJson({ error: "Invalid request origin" }, 403);

  try {
    const id = await contactIdFrom(context);
    const [contact] = await query<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM contacts WHERE id=$1 AND owner_user_id=$2) AS exists", [id, userId]);
    if (!contact?.exists) return privateJson({ error: "Person not found" }, 404);
    await query(
      "DELETE FROM contact_photos p USING contacts c WHERE p.contact_id=$1 AND c.id=p.contact_id AND c.owner_user_id=$2",
      [id, userId],
    );
    return privateJson({ uploaded_photo_updated_at: null });
  } catch (error) {
    return failure(error);
  }
}
