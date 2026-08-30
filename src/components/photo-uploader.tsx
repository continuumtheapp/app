"use client";

import { useState } from "react";
import { MAX_PHOTOS_PER_LISTING, MAX_PHOTO_BYTES } from "@/lib/photos";

/**
 * Photos go straight from the browser to R2 via a presigned URL, so the image
 * bytes never pass through the Worker. Large images are downscaled here first:
 * a 12 MP phone photo is pointless on a listing card and would blow the 5 MB cap.
 */
const MAX_DIMENSION = 2000;

export function PhotoUploader({
  keys,
  onChange,
}: {
  keys: string[];
  onChange: (keys: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);

    const room = MAX_PHOTOS_PER_LISTING - keys.length;
    if (room <= 0) {
      setError(`That's the limit of ${MAX_PHOTOS_PER_LISTING} photos.`);
      return;
    }

    setBusy(true);
    const added: string[] = [];
    const newPreviews: Record<string, string> = {};

    for (const file of Array.from(files).slice(0, room)) {
      try {
        const resized = await downscale(file);
        if (resized.size > MAX_PHOTO_BYTES) {
          setError(`"${file.name}" is too large even after resizing.`);
          continue;
        }

        const signResponse = await fetch("/api/photos/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: resized.type }),
        });
        if (!signResponse.ok) {
          const body = (await signResponse.json()) as { error?: string };
          setError(body.error ?? "Couldn't start the upload.");
          continue;
        }
        const { uploadUrl, key } = (await signResponse.json()) as { uploadUrl: string; key: string };

        // Content-Type must match what was signed, or R2 rejects the PUT.
        const put = await fetch(uploadUrl, {
          method: "PUT",
          body: resized,
          headers: { "Content-Type": resized.type },
        });
        if (!put.ok) {
          setError(`Couldn't upload "${file.name}".`);
          continue;
        }

        added.push(key);
        newPreviews[key] = URL.createObjectURL(resized);
      } catch {
        setError(`Couldn't process "${file.name}".`);
      }
    }

    setPreviews((p) => ({ ...p, ...newPreviews }));
    onChange([...keys, ...added]);
    setBusy(false);
  }

  return (
    <div>
      {keys.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
          {keys.map((key, i) => (
            <div key={key} className="relative group aspect-square rounded-lg overflow-hidden border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[key] ?? ""} alt="" className="size-full object-cover bg-paper" />
              {i === 0 && (
                <span className="absolute bottom-1 left-1 badge bg-white/90 text-ink text-[10px]">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => onChange(keys.filter((k) => k !== key))}
                className="absolute top-1 right-1 size-6 rounded-full bg-white/90 text-ink
                           opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="btn btn-secondary cursor-pointer">
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
               disabled={busy || keys.length >= MAX_PHOTOS_PER_LISTING}
               onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        {busy ? "Uploading…" : keys.length === 0 ? "Add photos" : "Add more"}
      </label>

      <p className="mt-2 text-xs text-ink-faint">
        Up to {MAX_PHOTOS_PER_LISTING}. The first one is the cover.
      </p>
      {error && <p className="mt-1.5 text-xs text-flinta">{error}</p>}
    </div>
  );
}

/** Downscale to at most MAX_DIMENSION on the long edge, re-encoded as JPEG. */
async function downscale(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

  if (scale === 1 && file.size <= MAX_PHOTO_BYTES) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}
