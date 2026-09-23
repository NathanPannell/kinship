import sharp from "sharp";

type ImageMetadata = Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;

export const maxContactPhotoUploadBytes = 4_000_000;
export const maxContactPhotoStoredBytes = 98_304;

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImagePixels = 16_000_000;
const maxImageSide = 8_000;

export class ContactPhotoError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ContactPhotoError";
  }
}

function sniffMimeType(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function prepareContactPhoto(input: Uint8Array, claimedMimeType: string): Promise<Buffer> {
  if (!allowedMimeTypes.has(claimedMimeType)) {
    throw new ContactPhotoError("Choose a JPEG, PNG, or WebP image.", 415);
  }
  if (input.byteLength === 0) {
    throw new ContactPhotoError("Choose an image file that contains data.", 400);
  }
  if (input.byteLength > maxContactPhotoUploadBytes) {
    throw new ContactPhotoError("Choose an image no larger than 4 MB.", 413);
  }

  const source = Buffer.from(input);
  const detectedMimeType = sniffMimeType(source);
  if (!detectedMimeType || detectedMimeType !== claimedMimeType) {
    throw new ContactPhotoError("The file contents do not match a supported image type.", 415);
  }

  let image = sharp(source, { failOn: "error", limitInputPixels: maxImagePixels, sequentialRead: true });
  let metadata: ImageMetadata;
  try {
    metadata = await image.metadata();
  } catch {
    throw new ContactPhotoError("This image could not be read. Try another file.", 400);
  }

  const expectedFormat = claimedMimeType === "image/jpeg" ? "jpeg" : claimedMimeType === "image/png" ? "png" : "webp";
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (metadata.format !== expectedFormat || !width || !height || width > maxImageSide || height > maxImageSide || width * height > maxImagePixels) {
    throw new ContactPhotoError("Choose a still image up to 8,000 pixels per side and 16 megapixels.", 400);
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new ContactPhotoError("Animated images are not supported. Choose a still image.", 400);
  }

  try {
    for (const quality of [72, 60, 50]) {
      image = sharp(source, { failOn: "error", limitInputPixels: maxImagePixels, sequentialRead: true });
      const output = await image
        .rotate()
        .resize(256, 256, { fit: "cover", position: "attention", withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer();
      if (output.byteLength <= maxContactPhotoStoredBytes) return output;
    }
  } catch {
    throw new ContactPhotoError("This image could not be processed. Try another file.", 400);
  }

  throw new ContactPhotoError("This image could not be compressed small enough. Try a simpler image.", 400);
}
