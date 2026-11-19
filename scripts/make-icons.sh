#!/bin/sh
# Builds every icon from the logo in brand/simba-logo-source.png (needs ImageMagick).
# Run from the Code folder: sh scripts/make-icons.sh
set -e
SRC=brand/simba-logo-source.png
PETROL="#014E4B"
# The gold mark sits at this box in the source; cropping it lets each size
# choose its own padding around it.
MARK=$(mktemp -t simba-mark).png
magick "$SRC" -crop 921x1010+174+106 +repage "$MARK"

# square SIZE FILL OUT [THICKEN]: the mark at FILL (0-1) of the height,
# centred on petrol. THICKEN widens the rays first, so they survive being
# shrunk to a few pixels in a browser tab.
square() {
  inner=$(awk "BEGIN { printf \"%d\", $1 * $2 }")
  magick "$MARK" ${4:+-morphology Dilate Disk:$4} -resize "x${inner}" \
    -background "$PETROL" -gravity center -extent "${1}x${1}" \
    -colors 64 -strip -define png:compression-level=9 "$3"
}

# Browser tabs: small sizes get the mark as big as possible.
square 16 0.94 /tmp/simba-16.png 30
square 32 0.92 /tmp/simba-32.png 10
square 48 0.90 /tmp/simba-48.png 6
magick /tmp/simba-16.png /tmp/simba-32.png /tmp/simba-48.png src/app/favicon.ico
square 512 0.84 src/app/icon.png
# iOS rounds the corners itself; it needs no transparency.
square 180 0.80 src/app/apple-icon.png
# Android home screen (web app manifest). "Maskable" keeps the mark inside
# the central safe zone, since Android may crop it to a circle.
square 192 0.84 public/icons/icon-192.png
square 512 0.84 public/icons/icon-512.png
square 512 0.64 public/icons/icon-maskable-512.png
# The mark in the site header, shown at 32px: 3x for sharp phone screens.
square 96 0.86 public/brand-mark.png
rm -f "$MARK" /tmp/simba-16.png /tmp/simba-32.png /tmp/simba-48.png
echo "Icons written."
