#!/usr/bin/env bash
# Export the print PDF to web pages for the flip book. Needs poppler (pdftoppm) and webp (cwebp).
# Crops to the TrimBox (29.5pt inset, 576x792pt) so bleed and printer marks are dropped.
set -euo pipefail
cd "$(dirname "$0")/.."
PDF=${1:-design/living-magazine.pdf}
OUT=public/magazine
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

render() { # dpi width prefix
  local dpi=$1 inset w h
  inset=$(python3 -c "print(round(29.5*$dpi/72))")
  w=$(python3 -c "print(round(576*$dpi/72))")
  h=$(python3 -c "print(round(792*$dpi/72))")
  pdftoppm -r "$dpi" -x "$inset" -y "$inset" -W "$w" -H "$h" -png "$PDF" "$TMP/$2"
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
