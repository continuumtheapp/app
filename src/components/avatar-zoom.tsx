"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "./avatar";

/**
 * A profile photo that opens full size when clicked. Without a photo it's
 * just the initial, with nothing to open.
 */
export function AvatarZoom({
  name, image, size = 40,
}: {
  name: string | null; image: string | null; size?: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (!image) return <Avatar name={name} image={null} size={size} />;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
              className="rounded-full shrink-0 cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-label={`See ${name ?? "this member"}'s photo`}>
        <Avatar name={name} image={image} size={size} />
      </button>
      <dialog ref={dialog} onClose={() => setOpen(false)}
              // A click on the backdrop lands on the dialog itself.
              onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
              className="m-auto bg-transparent p-0 max-w-[min(90vw,512px)] backdrop:bg-black/70">
        {open && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={name ?? ""}
                 className="block w-[min(90vw,512px)] max-h-[85vh] object-contain rounded-2xl bg-paper" />
            <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                    className="absolute top-2 right-2 size-9 rounded-full bg-white/90 text-ink text-xl leading-none">
              ×
            </button>
            {name && <p className="mt-2 text-center text-sm text-white">{name}</p>}
          </div>
        )}
      </dialog>
    </>
  );
}
