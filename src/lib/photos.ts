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
  bucket: string = requireEnv("R2_BUCKET"),
): Promise<{ uploadUrl: string; key: string }> {
  const url = new URL(objectUrl(bucket, key));
  url.searchParams.set("X-Amz-Expires", String(UPLOAD_URL_TTL_SECONDS));

  const signed = await r2Client().sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
    headers: { "Content-Type": contentType },
  });

  return { uploadUrl: signed.url, key };
}

/**
 * Public URL for a stored photo.
 *
 * `width` requests a resize through Cloudflare Image Transformations, which is
 * only available on a custom domain attached to a Cloudflare zone — the free
 * `*.r2.dev` development URL returns 404 for /cdn-cgi/image paths. So we fall
 * back to the full-size original there rather than serving broken images.
 *
 * Uploads are already downscaled to 2000px in the browser, so full-size is
 * acceptable; transformations are a bandwidth optimisation, not a requirement.
 * Point NEXT_PUBLIC_PHOTOS_BASE_URL at a custom domain to enable them. Note
 * only 5,000 unique (image, size) pairs per month are free, so stick to the
 * three widths below rather than passing arbitrary ones.
 */
export function photoUrl(key: string, width?: 400 | 800 | 1600): string {
  const base = (process.env.NEXT_PUBLIC_PHOTOS_BASE_URL ?? "").replace(/\/$/, "");
  const canTransform = !base.includes(".r2.dev");
  if (!width || !canTransform) return `${base}/${key}`;
  return `${base}/cdn-cgi/image/width=${width},quality=82,format=auto/${key}`;
}

/**
 * Delete a photo from R2, over the S3 API.
 *
 * There is no Workers binding here — the app runs on Vercel — so deletes go
 * through the same signed-request path as uploads.
 */
export async function deletePhoto(key: string, bucket: string = requireEnv("R2_BUCKET")): Promise<void> {
  const response = await r2Client().fetch(objectUrl(bucket, key), { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Could not delete photo ${key}: ${response.status}`);
  }
}

function r2Client(): AwsClient {
  return new AwsClient({
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
}

function objectUrl(bucket: string, key: string): string {
  return `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${bucket}/${key}`;
}

/* ------------------------------------------------------------- ID checks */

/**
 * ID photos and selfies go to their own bucket, which must have NO public
 * access (no r2.dev URL, no custom domain) and should be created with EU
 * jurisdiction. Admins see them only through links that expire in minutes,
 * and they're deleted as soon as the check is done.
 *
 * Locally, without R2_ID_BUCKET, they fall back to the photos bucket so the
 * flow can be tried; in production a missing R2_ID_BUCKET is an error, never
 * a silent fallback to the public bucket.
 */
export function idBucket(): string {
  const bucket = process.env.R2_ID_BUCKET;
  if (bucket) return bucket;
  if (process.env.NODE_ENV !== "production") return requireEnv("R2_BUCKET");
  return requireEnv("R2_ID_BUCKET");
}

export function idCheckKey(contentType: PhotoType): string {
  return `id-checks/${crypto.randomUUID()}.${EXTENSION[contentType]}`;
}

/** How long an admin's link to an ID photo works. */
const VIEW_URL_TTL_SECONDS = 300;

/** A short-lived link to look at one private object. */
export async function createViewUrl(key: string, bucket: string): Promise<string> {
  const url = new URL(objectUrl(bucket, key));
  url.searchParams.set("X-Amz-Expires", String(VIEW_URL_TTL_SECONDS));
  const signed = await r2Client().sign(new Request(url, { method: "GET" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}
