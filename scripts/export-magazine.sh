#!/usr/bin/env bash
# Export the print PDF to web pages for the flip book. Needs poppler (pdftoppm) and webp (cwebp).
# Crops to page 1's TrimBox (read with pdfinfo) so any bleed and printer marks are dropped.
set -euo pipefail
cd "$(dirname "$0")/.."
PDF=${1:-design/living-magazine.pdf}
OUT=public/magazine
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# TrimBox x0 y0 x1 y1 in pt, relative to the MediaBox.
read -r TX0 TY0 TX1 TY1 < <(pdfinfo -box -f 1 -l 1 "$PDF" | awk '/MediaBox/{mx=$4;my=$5;mh=$7} /TrimBox/{print $4-mx, mh-$7, $6-mx, mh-$5}')

render() { # dpi prefix
  local dpi=$1 x y w h
  x=$(python3 -c "print(round($TX0*$dpi/72))")
  y=$(python3 -c "print(round($TY0*$dpi/72))")
  w=$(python3 -c "print(round(($TX1-$TX0)*$dpi/72))")
  h=$(python3 -c "print(round(($TY1-$TY0)*$dpi/72))")
  pdftoppm -r "$dpi" -x "$x" -y "$y" -W "$w" -H "$h" -png "$PDF" "$TMP/$2"
}

mkdir -p "$OUT/thumbs"
rm -f "$OUT"/*.svg "$OUT"/*.webp "$OUT"/thumbs/*.webp
render 135 page # 1080px wide
for f in "$TMP"/page-*.png; do
  n=$(basename "$f" .png | sed 's/page-//')
  n=$(printf 'p%02d' $((10#$n)))
  cwebp -quiet -q 78 "$f" -o "$OUT/$n.webp"
  cwebp -quiet -q 70 -resize 120 0 "$f" -o "$OUT/thumbs/$n.webp"
done
# The cover illustration on its own (no QR code or overlaid copy) for the landing page.
pdfimages -f 1 -l 1 -png "$PDF" "$TMP/art"
for w in 1200 760; do cwebp -quiet -q 80 -resize "$w" 0 "$TMP/art-000.png" -o "public/cover-art-$w.webp"; done
echo "Exported $(ls "$OUT"/*.webp | wc -l | tr -d ' ') pages to $OUT"
