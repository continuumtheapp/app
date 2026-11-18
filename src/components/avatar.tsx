/** A member's profile photo, or their initial when they have none. */
export function Avatar({
  name, image, size = 40,
}: {
  name: string | null; image: string | null; size?: number;
}) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };

  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" style={style}
                className="rounded-full object-cover bg-paper border border-line shrink-0" />;
  }
  return (
    <span style={style} aria-hidden
          className="rounded-full bg-accent-soft text-accent-ink font-medium shrink-0
                     inline-flex items-center justify-center">
      {initial}
    </span>
  );
}
