/**
 * The flip-through magazine: every page of the printed issue, cover to back cover (page-flip needs an
 * even count). Pages are exported from the print PDF by scripts/export-magazine.sh, trimmed to 8×11in.
 */
const ids = Array.from({ length: 74 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`)

export const magazine = {
  width: 720,
  height: 990,
  pages: ids.map((id) => `/magazine/${id}.webp`),
  thumbs: ids.map((id) => `/magazine/thumbs/${id}.webp`),
}
