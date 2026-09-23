import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { maxContactPhotoStoredBytes, prepareContactPhoto } from "./contact-photo";

describe("contact photo preparation", () => {
  it("converts supported uploads into small, square WebP avatars", async () => {
    const jpeg = await sharp({
      create: { width: 900, height: 600, channels: 3, background: { r: 108, g: 75, b: 52 } },
    }).jpeg().toBuffer();

    const output = await prepareContactPhoto(jpeg, "image/jpeg");
    const metadata = await sharp(output).metadata();

    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
    expect(output.byteLength).toBeLessThanOrEqual(maxContactPhotoStoredBytes);
  });

  it("rejects a MIME type that does not match the image bytes", async () => {
    const png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 10, g: 20, b: 30 } },
    }).png().toBuffer();

    await expect(prepareContactPhoto(png, "image/jpeg")).rejects.toMatchObject({ status: 415 });
  });

  it("rejects uploads above the input byte limit before decoding them", async () => {
    await expect(prepareContactPhoto(new Uint8Array(4_000_001), "image/jpeg")).rejects.toMatchObject({ status: 413 });
  });

  it("rejects malformed files with a supported file signature", async () => {
    const malformedJpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]);
    await expect(prepareContactPhoto(malformedJpeg, "image/jpeg")).rejects.toMatchObject({ status: 400 });
  });
});
