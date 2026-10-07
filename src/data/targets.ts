import type { ExperienceConfig, TargetConfig, TimelineContent } from '../ar/types'

/**
 * Livin’ Magazine pages that come alive. Each `image` is the page as exported by
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
  // Prebuilt in the background: a film only fetches its poster and the video's header up front (the
  // video itself streams on play), so the framed poster is ready the moment the page is found.
  content: [
    {
      type: 'film',
      id: 'bee-documentary',
      src: '/videos/bees-ar-mobile.mp4',
      poster: '/ar/p15/poster.webp',
      title: 'Queen’s Honeybee Farm',
      frame: 'stamp',
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
  // Prebuilt in the background: a film only fetches its poster and the video's header up front (the
  // video itself streams on play), so the framed poster is ready the moment the page is found.
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
  // Prebuilt in the background: a film only fetches its poster and the video's header up front (the
  // video itself streams on play), so the framed poster is ready the moment the page is found.
  content: [
    {
      type: 'film',
      id: 'yano',
      src: '/videos/yano.mp4',
      poster: '/ar/p30/poster.webp',
      title: 'Yano',
      subtitle: 'Community Development Worker',
      frame: 'script',
      decor: 'swash',
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
  // Tall layered scene: hold it steadier than the default (see TargetConfig.poseFilter).
  poseFilter: { minCutoff: 0.18, beta: 1.2 },
  content: [
    {
      type: 'model',
      id: 'magwai-sunscreen',
      asset: '/models/magwai-sunscreen.glb',
      // Nearly flat and centred on the page, so the layered reef cards face a phone looking down at it and
      // pop up towards it (their layers spread 1.5× for depth; more and the tall reef magnified tracking jitter).
      hide: ['Cube.006'], // a leftover shampoo box from the shared scene
      at: [540, 1430],
      width: 760,
      depth: 1.5,
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
  // Tall layered scene: hold it steadier than the default (see TargetConfig.poseFilter).
  poseFilter: { minCutoff: 0.18, beta: 1.2 },
  content: [
    {
      type: 'model',
      id: 'magwai-shampoo',
      asset: '/models/magwai-shampoo.glb',
      hide: ['cap.001'], // the sunscreen tube belongs to p40
      at: [540, 1430],
      width: 760,
      depth: 1.5,
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

/** p58 "Pangat: Ang Pagbabalik ng Leftovers": turn the printed knob to heat the pan until the leftover lechon comes back as paksiw. */
const page58: TargetConfig = {
  id: 'page58',
  targetIndex: 11,
  title: 'Pangat',
  image: '/magazine/p58.webp',
  size: [1080, 1485],
  prefetch: false,
  content: [
    {
      type: 'pangat',
      id: 'pangat',
      asset: '/models/pangat.glb',
      // Seen a little from above like the stove photo; the pot centred on the printed flame (x 291–836),
      // sitting in its lower half so the painted tongues rise around it.
      at: [563, 600],
      width: 500,
      stand: 15,
      knob: { at: [493, 1256], radius: 236 },
    },
  ],
}

/** p61 "Kapusod": Howie Severino's docufilm pops up over his printed portrait, captioned on the page's leaf green. */
const page61: TargetConfig = {
  id: 'page61',
  targetIndex: 12,
  title: 'Kapusod',
  image: '/magazine/p61.webp',
  size: [1080, 1485],
  // Prebuilt in the background: a film only fetches its poster and the video's header up front (the
  // video itself streams on play), so the framed poster is ready the moment the page is found.
  content: [
    {
      type: 'film',
      id: 'kapusod',
      src: '/videos/kapusod.mp4',
      poster: '/ar/p61/poster.webp',
      title: 'Kapusod',
      subtitle: 'Howie Severino',
      frame: 'script',
      accent: '#5d784f', // the page's green "Kapusod" script
      decor: 'leaves',
      // The film window over the printed portrait (x 329–993, y 257–626): frame = 664 × 1200/1060.
      at: [661, 480],
      width: 752,
      lift: 0.02,
    },
  ],
}

/** p68 "Deep Ecology": the painting grows over the print, black background keyed out (scripts/alpha-clip.py --key black --soft 180, so its glow fades out without a dark halo). */
const page68: TargetConfig = {
  id: 'page68',
  targetIndex: 13,
  title: 'Deep Ecology',
  image: '/magazine/p68.webp',
  size: [1080, 1485],
  content: [
    {
      type: 'alpha-video',
      id: 'deep-ecology',
      src: '/ar/p68/deep-ecology.mp4',
      // The clip draws the painting 1/1.207 of its printed size; registered (SIFT) so it lands on the print.
      at: [559, 663],
      width: 1304,
      loop: true,
    },
  ],
}

/** p56 "Sharon, Save Me a Plate!": the fiesta table comes alive inside the page's own border (scripts/page-video.py --under-frame). */
const page56: TargetConfig = {
  id: 'page56',
  targetIndex: 14,
  title: 'Sharon, Save Me a Plate!',
  image: '/magazine/p56.webp',
  size: [1080, 1485],
  content: [{ type: 'video', id: 'sharon', src: '/ar/p56/sharon.mp4', cover: true, at: [540, 742], width: 1080, loop: true }],
}

/** p16, the bee species: the three printed bees take off and fly around the page, then land back. */
const page16: TargetConfig = {
  id: 'page16',
  targetIndex: 15,
  title: 'Laywan, Lukot, Pukyutan',
  image: '/magazine/p16.webp',
  size: [1080, 1485],
  content: [
    {
      type: 'bees',
      id: 'bee-species',
      // Cut out of the page (body, wings, clean spot); positions from that cut.
      bees: [
        { body: '/ar/p16/laywan-body.webp', wings: '/ar/p16/laywan-wings.webp', spot: '/ar/p16/laywan-spot.webp', at: [392.5, 322.5], width: 385, hinge: [0.545, 0.4], orbit: [560, 420], radius: [330, 220], delay: 0.6 },
        { body: '/ar/p16/lukot-body.webp', wings: '/ar/p16/lukot-wings.webp', spot: '/ar/p16/lukot-spot.webp', at: [207.5, 920], width: 225, hinge: [0.489, 0.375], orbit: [380, 860], radius: [280, 200], facesRight: true, delay: 1.4, pitch: 1.35 },
        { body: '/ar/p16/pukyutan-body.webp', wings: '/ar/p16/pukyutan-wings.webp', spot: '/ar/p16/pukyutan-spot.webp', at: [795, 1275], width: 360, hinge: [0.653, 0.438], orbit: [680, 1150], radius: [320, 230], delay: 2.2, pitch: 0.8 },
      ],
    },
  ],
}

export const experience: ExperienceConfig = {
  mindFile: '/targets/targets.mind',
  targets: [page13, page15, page13Closeup, page22, page24, page30, page34, page39, page40, page41, page52, page58, page61, page68, page56, page16],
}
