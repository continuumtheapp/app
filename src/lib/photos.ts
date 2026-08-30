/**
 * Photo uploads: the browser PUTs directly to R2 using a presigned URL, so the
 * image bytes never pass through the Worker (which has tight CPU and body
 * limits, and would burn request time proxying them).
 *
 * R2 speaks the S3 API — an interface standard, not an Amazon service. There
 * is no AWS account involved; `aws4fetch` is a ~4 KB signer for that format.
 */
import { AwsClient } from "aws4fetch";
import { requireEnv } from "./env";

export const MAX_PHOTOS_PER_LISTING = 10;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoType = (typeof ALLOWED_PHOTO_TYPES)[number];

/** Presigned URLs are bearer tokens: keep the window short. */
const UPLOAD_URL_TTL_SECONDS = 600; // 10 minutes

export function isAllowedPhotoType(type: string): type is PhotoType {
  return (ALLOWED_PHOTO_TYPES as readonly string[]).includes(type);
}

const EXTENSION: Record<PhotoType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Opaque, unguessable object key. Listing id is a prefix so cleanup is easy. */
export function photoKey(listingId: number, contentType: PhotoType): string {
  return `listings/${listingId}/${crypto.randomUUID()}.${EXTENSION[contentType]}`;
}

/**
 * A URL the browser can PUT one photo to.
 *
 * Content-Type is pinned into the signature: if the browser sends a different
 * one, R2 rejects it with SignatureDoesNotMatch. The client must send exactly
 * the type it declared here.
 */
export async function createUploadUrl(
  key: string,
  contentType: PhotoType,
): Promise<{ uploadUrl: string; key: string }> {
  const client = new AwsClient({
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });

  const endpoint = `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${requireEnv("R2_BUCKET")}/${key}`;
  const url = new URL(endpoint);
  url.searchParams.set("X-Amz-Expires", String(UPLOAD_URL_TTL_SECONDS));

  const signed = await client.sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
    headers: { "Content-Type": contentType },
  });

  return { uploadUrl: signed.url, key };
}

/**
 * Public URL for a stored photo.
 *
 * `width` goes through Cloudflare Image Transformations, which resizes on the
 * fly. Only 5,000 unique (image, size) pairs per month are free, so stick to
 * the few sizes below rather than passing arbitrary widths.
 */
export function photoUrl(key: string, width?: 400 | 800 | 1600): string {
  const base = (process.env.NEXT_PUBLIC_PHOTOS_BASE_URL ?? "").replace(/\/$/, "");
  if (!width) return `${base}/${key}`;
  return `${base}/cdn-cgi/image/width=${width},quality=82,format=auto/${key}`;
}

/**
 * Delete a photo from R2, over the S3 API.
 *
 * There is no Workers binding here — the app runs on Vercel — so deletes go
 * through the same signed-request path as uploads.
 */
export async function deletePhoto(key: string): Promise<void> {
  const client = new AwsClient({
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
  const endpoint = `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${requireEnv("R2_BUCKET")}/${key}`;
  const response = await client.fetch(endpoint, { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Could not delete photo ${key}: ${response.status}`);
  }
}
