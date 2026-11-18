"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Big enough to read an ID card, small enough to upload quickly on a phone. */
const MAX_SIDE = 1600;

type Slot = "doc" | "selfie";

/**
 * Upload a photo of an ID and a selfie for an admin to compare. Both go to
 * private storage and are deleted once the check is done.
 */
export function IdCheckForm() {
  const router = useRouter();
  const [keys, setKeys] = useState<Record<Slot, string | null>>({ doc: null, selfie: null });
  const [previews, setPreviews] = useState<Record<Slot, string | null>>({ doc: null, selfie: null });
  const [busy, setBusy] = useState<Slot | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(slot: Slot, file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(slot);
    try {
      const image = await shrink(file);
      const sign = await fetch("/api/photos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: image.type, purpose: "id-check" }),
      });
      const signed = (await sign.json()) as { uploadUrl?: string; key?: string; error?: string };
      if (!sign.ok || !signed.uploadUrl || !signed.key) throw new Error(signed.error ?? "Couldn't start the upload.");
      const put = await fetch(signed.uploadUrl, {
        method: "PUT", body: image, headers: { "Content-Type": image.type },
      });
      if (!put.ok) throw new Error("Couldn't upload the photo.");
      setKeys((k) => ({ ...k, [slot]: signed.key! }));
      setPreviews((p) => ({ ...p, [slot]: URL.createObjectURL(image) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't use that photo.");
    }
    setBusy(null);
  }

  async function send() {
    if (!keys.doc || !keys.selfie) return;
    setBusy("send");
    setError(null);
    const response = await fetch("/api/id-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docKey: keys.doc, selfieKey: keys.selfie }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Couldn't send that.");
      setBusy(null);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-5 space-y-5">
      <PhotoSlot label="Your ID or passport"
                 hint="The side with your photo and name. You can black out the ID number."
                 preview={previews.doc} uploading={busy === "doc"}
                 onPick={(f) => pick("doc", f)} />
      <PhotoSlot label="A selfie"
                 hint="Just your face, clearly lit, so we can compare it with the ID."
                 preview={previews.selfie} uploading={busy === "selfie"} capture
                 onPick={(f) => pick("selfie", f)} />
      {error && <p className="text-sm text-flinta">{error}</p>}
      <div className="flex justify-end">
        <button type="button" onClick={send} className="btn btn-primary"
                disabled={!keys.doc || !keys.selfie || busy !== null}>
          {busy === "send" ? "Sending…" : "Send for checking"}
        </button>
      </div>
    </div>
  );
}

function PhotoSlot({ label, hint, preview, uploading, capture, onPick }: {
  label: string; hint: string; preview: string | null; uploading: boolean;
  capture?: boolean; onPick: (file: File | undefined) => void;
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <p className="text-xs text-ink-faint -mt-0.5 mb-2">{hint}</p>
      <div className="flex items-center gap-4">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-20 w-28 rounded-lg border border-line object-cover" />
        )}
        <label className="btn btn-secondary cursor-pointer">
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploading}
                 {...(capture ? { capture: "user" as const } : {})}
                 onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} />
          {uploading ? "Uploading…" : preview ? "Change" : "Add a photo"}
        </label>
      </div>
    </div>
  );
}

/** Downscale and re-encode as JPEG (also drops the photo's location metadata). */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Couldn't read that image.");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}
