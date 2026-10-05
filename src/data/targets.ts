import type { ExperienceConfig, TargetConfig } from '../ar/types'

/**
 * Living Magazine pages that come alive. Each `image` is the page as exported by
 * scripts/export-magazine.sh; recompile public/targets/targets.mind (/compile.html) after adding one.
 */

/**
 * p13 "Lola's Beauty Drawer Was The Kitchen" — the basket. Fruits fly out of the printed basket and
 * speech bubbles explain each one, rebuilt from the design team's render (scripts/extract-page13.py).
 */
const page13: TargetConfig = {
  id: 'page13',
  targetIndex: 0,
  title: "Lola's Beauty Drawer Was The Kitchen",
  image: '/magazine/p13.webp',
  size: [1080, 1485],
  content: [
    {
      type: 'timeline',
      id: 'basket',
      src: '/ar/p13/timeline.json',
      // Staggered heights so the fruits separate in depth as the phone moves.
      lift: {
        ampalaya: 0.03,
        turmeric: 0.04,
        ube: 0.045,
        calamansi: 0.035,
        coconut: 0.05,
        papaya: 0.04,
      },
    },
  ],
}

export const experience: ExperienceConfig = {
  mindFile: '/targets/targets.mind',
  targets: [page13],
}
