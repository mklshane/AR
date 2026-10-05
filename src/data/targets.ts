import type { ExperienceConfig, TargetConfig, TimelineContent } from '../ar/types'

/**
 * Living Magazine pages that come alive. Each `image` is the page as exported by
 * scripts/export-magazine.sh; recompile public/targets/targets.mind (/compile.html) after adding one.
 */

/**
 * p13 "Lola's Beauty Drawer Was The Kitchen" — the basket. Fruits fly out of the printed basket and
 * speech bubbles explain each one, rebuilt from the design team's render (scripts/extract-page13.py).
 */
const basketTimeline: TimelineContent = {
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
  captions: {
    'bubble-coconut':
      "From niyog to natural skincare. Coconut produces versatile oil that helps moisturize and support the skin's natural barrier.",
    'bubble-ube':
      'Purple, vibrant, and antioxidant-rich. Ube gets its signature color from anthocyanins, natural compounds known for their antioxidant properties.',
    'bubble-calamansi':
      'Small fruit, big vitamin C energy. Calamansi is a Filipino kitchen staple known for its bright, citrusy flavor and antioxidant-rich juice.',
    'bubble-papaya':
      'Sweet fruit, powerful enzyme. Papaya contains papain, an enzyme commonly used in gentle exfoliating and brightening skincare products.',
    'bubble-turmeric':
      'Golden spice with a soothing side. Turmeric contains curcumin, a natural compound studied for its antioxidant and anti-inflammatory properties.',
    'bubble-ampalaya':
      'Bitter by taste, beneficial by nature. Ampalaya is packed with plant compounds and antioxidants, making it a popular ingredient in traditional wellness and skincare.',
  },
}

const page13: TargetConfig = {
  id: 'page13',
  targetIndex: 0,
  group: 'page13',
  title: "Lola's Beauty Drawer Was The Kitchen",
  image: '/magazine/p13.webp',
  size: [1080, 1485],
  content: [basketTimeline],
}

/**
 * The top half of p13 on its own, so the AR keeps tracking with the phone held close to the basket.
 * Size and region are printed by scripts/extract-page13.py.
 */
const page13Closeup: TargetConfig = {
  id: 'page13-closeup',
  targetIndex: 2,
  group: 'page13',
  title: "Lola's Beauty Drawer Was The Kitchen (close-up)",
  image: '/ar/p13/closeup.webp',
  size: [1814, 1590],
  content: [{ ...basketTimeline, region: [173, 16, 907, 795] }],
}

/** Joseph Del Rio's beekeeping story, keyed to the hexagonal beekeeper photograph. */
const page15: TargetConfig = {
  id: 'page15',
  targetIndex: 1,
  title: 'Inside the Hive',
  image: '/magazine/p15.webp',
  size: [1080, 1485],
  prefetch: false,
  content: [
    {
      type: 'bee-film',
      id: 'bee-documentary',
      src: '/videos/bees-ar-mobile.mp4',
      at: [540, 936],
      width: 960,
      lift: 0.055,
    },
  ],
  tapBurst: { colors: ['#f4c65a', '#e7a928', '#fff2cc'] },
}

/**
 * p22, the eco-printed leaf cloth beside "4 Elements, 1 Process": the cut-out leaves fly back into the
 * holes they were cut from (the design team's ILI LEAVES render, keyed by scripts/alpha-clip.py).
 */
const page22: TargetConfig = {
  id: 'page22',
  targetIndex: 3,
  title: 'Ili leaves',
  image: '/magazine/p22.webp',
  size: [1080, 1485],
  content: [{ type: 'alpha-video', id: 'leaves', src: '/ar/p22/leaves.mp4', at: [540, 742.5], width: 1080 }],
}

export const experience: ExperienceConfig = {
  mindFile: '/targets/targets.mind',
  targets: [page13, page15, page13Closeup, page22],
}
