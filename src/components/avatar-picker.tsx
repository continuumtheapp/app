"use client";

import { useState } from "react";
import { AvatarZoom } from "./avatar-zoom";

/** Profile photos are shown small: a 512px square is plenty. */
const AVATAR_SIZE = 512;

/**
 * Pick, crop and upload a profile photo. Used on the profile page and when
 * asking to join. Reports the uploaded key (or null when removed) through
 * onChange; saving it to the profile is the parent form's job.
 */
export function AvatarPicker({
  name, initialImage, onChange, onError, onUploading,
}: {
  name: string | null;
  initialImage: string | null;
  onChange: (avatarKey: string | null) => void;
  onError: (message: string | null) => void;
  onUploading?: (uploading: boolean) => void;
}) {
  const [preview, setPreview] = useState<string | null>(initialImage);
  const [uploading, setUploading] = useState(false);

  function busy(value: boolean) {
    setUploading(value);
    onUploading?.(value);
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    onError(null);
    busy(true);
    try {
      const square = await squareCrop(file, AVATAR_SIZE);
      const sign = await fetch("/api/photos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: square.type, purpose: "avatar" }),
      });
      const signed = (await sign.json()) as { uploadUrl?: string; key?: string; error?: string };
      if (!sign.ok || !signed.uploadUrl || !signed.key) {
        throw new Error(signed.error ?? "Couldn't start the upload.");
      }
      // Content-Type must match what was signed, or R2 rejects the PUT.
      const put = await fetch(signed.uploadUrl, {
        method: "PUT", body: square, headers: { "Content-Type": square.type },
      });
      if (!put.ok) throw new Error("Couldn't upload the photo.");
      setPreview(URL.createObjectURL(square));
      onChange(signed.key);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't use that photo.");
    }
    busy(false);
  }

  return (
    <div className="flex items-center gap-4">
      <AvatarZoom name={name} image={preview} size={72} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn btn-secondary cursor-pointer">
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploading}
                 onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
          {uploading ? "Uploading…" : preview ? "Change photo" : "Add a photo"}
        </label>
        {preview && (
          <button type="button" onClick={() => { setPreview(null); onChange(null); }}
                  className="btn btn-secondary">
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

/** Center-crop to a square and re-encode as JPEG. */
async function squareCrop(file: File, size: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(size, side);
  canvas.getContext("2d")!.drawImage(
    bitmap,
    (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
    0, 0, canvas.width, canvas.height,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't read that image.");
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}
