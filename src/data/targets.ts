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
      type: 'film',
      id: 'bee-documentary',
      src: '/videos/bees-ar-mobile.mp4',
      poster: '/ar/p15/poster.webp',
      title: 'Queen’s Honeybee Farm',
      frame: 'hex',
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

/** p24 "Teacher Maui": the Ili Likhaan docufilm over the portrait, framed with the page's own flourishes. */
const page24: TargetConfig = {
  id: 'page24',
  targetIndex: 4,
  title: 'Teacher Maui',
  image: '/magazine/p24.webp',
  size: [1080, 1485],
  prefetch: false,
  content: [
    {
      type: 'film',
      id: 'ili-likhaan',
      src: '/videos/ili-likhaan.mp4',
      poster: '/ar/p24/poster.webp',
      title: 'Ili Likhaan',
      subtitle: 'Teacher Maui',
      frame: 'flourish',
      // Window's top-left on the printed portrait's (205, 135), at its width (710): frame = 710 × 1200/1060.
      at: [560, 376],
      width: 804,
      // Low, so the top-left flourish stays over its printed twin as the phone tilts.
      lift: 0.02,
    },
  ],
}

/** p30 "Yano": his docufilm pops up over the portrait, captioned in the page's white script. */
const page30: TargetConfig = {
  id: 'page30',
  targetIndex: 5,
  title: 'Yano',
  image: '/magazine/p30.webp',
  size: [1080, 1485],
  prefetch: false,
  content: [
    {
      type: 'film',
      id: 'yano',
      src: '/videos/yano.mp4',
      poster: '/ar/p30/poster.webp',
      title: 'Yano',
      subtitle: 'Community Development Worker',
      frame: 'script',
      // Over his chest, then it lifts off to fill the screen.
      at: [540, 820],
      width: 980,
      lift: 0.02,
    },
  ],
}

/** p34 "The Ice Cream is Gone": the Selecta tub on the printed tray; tap it to find the fish. */
const page34: TargetConfig = {
  id: 'page34',
  targetIndex: 6,
  title: 'The Ice Cream is Gone',
  image: '/magazine/p34.webp',
  size: [1080, 1485],
  prefetch: false,
  // Centred on the printed tray (495 × 745 px), long enough to cover it.
  content: [{ type: 'tub', id: 'ice-cream-tub', asset: '/models/ice-cream-tub.glb', at: [518, 802], length: 680 }],
}

/** p39 "The Thrift-Up Doll": drag the printed clothes onto the paper doll. */
const page39: TargetConfig = {
  id: 'page39',
  targetIndex: 7,
  title: 'The Thrift-Up Doll',
  image: '/magazine/p39.webp',
  size: [1080, 1485],
  content: [
    {
      type: 'paper-doll',
      id: 'thrift-up-doll',
      cover: '/ar/p39/page.webp',
      note: { title: 'Dress me up!', hint: 'Drag clothes onto me · tap to take off' },
      // The doll's cut-out, generously: dropping anywhere on her counts.
      body: [60, 260, 310, 1200],
      // Worn positions and scales were fitted by overlaying each piece on the doll.
      pieces: [
        // Tops cover her shoulders up to the neck; the jeans reach the shoes, which sit over her feet.
        { id: 'vest', src: '/ar/p39/vest.webp', home: [540, 530], width: 227, worn: [219, 686], wornScale: 1.0, slot: 'outfit' },
        { id: 'leopard', src: '/ar/p39/halfbody.webp', home: [541, 917], width: 285, worn: [219, 716], wornScale: 0.97, slot: 'outfit' },
        { id: 'pink', src: '/ar/p39/pink.webp', home: [872, 654], width: 289, worn: [219, 881], wornScale: 1.24, slot: 'outfit' },
        { id: 'denim', src: '/ar/p39/denim.webp', home: [870, 1199], width: 353, worn: [221, 673], wornScale: 1.03, slot: 'outfit' },
        { id: 'shoes', src: '/ar/p39/shoes.webp', home: [520, 1281], width: 223, worn: [203, 1339], wornScale: 0.86, slot: 'shoes' },
      ],
    },
  ],
}

/** p40 "MAGWAI wants your beach bag…": the reef-safe sunscreen rising out of a watercolour reef, mid-page. */
const page40: TargetConfig = {
  id: 'page40',
  targetIndex: 8,
  title: 'MAGWAI Sunscreen',
  image: '/magazine/p40.webp',
  size: [1080, 1485],
  prefetch: false,
  content: [
    {
      type: 'model',
      id: 'magwai-sunscreen',
      asset: '/models/magwai-sunscreen.glb',
      // Nearly flat and centred on the page, so the layered reef cards face a phone looking down at it and
      // pop up towards it (their layers spread 2.2× for depth).
      hide: ['Cube.006'], // a leftover shampoo box from the shared scene
      at: [540, 1430],
      width: 760,
      depth: 2.2,
      sway: true,
      scale: 1,
      stand: 12,
    },
  ],
}

/** p41 "Then MAGWAI looked at the bathroom": the shampoo bar rising out of the same reef, mid-page. */
const page41: TargetConfig = {
  id: 'page41',
  targetIndex: 9,
  title: 'MAGWAI Shampoo Bar',
  image: '/magazine/p41.webp',
  size: [1080, 1485],
  prefetch: false,
  content: [
    {
      type: 'model',
      id: 'magwai-shampoo',
      asset: '/models/magwai-shampoo.glb',
      hide: ['cap.001'], // the sunscreen tube belongs to p40
      at: [540, 1430],
      width: 760,
      depth: 2.2,
      sway: true,
      scale: 1,
      stand: 12,
    },
  ],
}

/** p52 "It's Four O'Clock!": the clock's people and things come alive over the print (scripts/page-video.py --alpha). */
const page52: TargetConfig = {
  id: 'page52',
  targetIndex: 10,
  title: "It's Four O'Clock!",
  image: '/magazine/p52.webp',
  size: [1080, 1485],
  content: [{ type: 'alpha-video', id: 'four-oclock', src: '/ar/p52/four-oclock-alpha.mp4', at: [540, 742], width: 1080, loop: true }],
}

export const experience: ExperienceConfig = {
  mindFile: '/targets/targets.mind',
  targets: [page13, page15, page13Closeup, page22, page24, page30, page34, page39, page40, page41, page52],
}
