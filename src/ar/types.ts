/**
 * Target + content configuration types.
 *
 * Positions use the *target image's pixel coordinates* (origin top-left, y down), so you can read
 * them straight off the artwork in any image editor. `coords.ts` converts them into anchor space.
 * `lift` is height above the page, in fractions of the page width (0.1 = 10% of page width).
 */

export type Px = [x: number, y: number]
export type Rect = [x0: number, y0: number, x1: number, y1: number]

interface Placed {
  id: string
  /** Centre of the item on the page, in target-image pixels. */
  at: Px
  /** Resting height above the page (fraction of page width). */
  lift?: number
  /** Seconds after the target is found before this item animates in. */
  delay?: number
}

/** A crop of the target image itself that lifts off the page — a "2.5D" pop-out sticker. */
export interface CutoutContent extends Placed {
  type: 'cutout'
  crop: Rect
  /** Remove the sky-blue background so only the artwork remains. */
  keySky?: boolean
  /** Paint this colour where the sticker was "peeled" from, hiding the printed original. */
  hole?: string
  /** Idle bob amplitude (fraction of page width). */
  bob?: number
  /** Idle tilt amplitude in degrees. */
  wobble?: number
}

export interface StarContent extends Placed {
  type: 'star'
  /** Outer radius in target pixels. */
  size: number
  color: string
  halftone?: boolean
  /** Spin speed in turns per second. */
  spin?: number
  /** Resting rotation around the page normal, in degrees. */
  rotation?: number
}

export interface HeartContent extends Placed {
  type: 'heart'
  size: number
  color: string
  /** Beats per minute of the idle heartbeat. */
  bpm?: number
}

export interface CloudContent extends Placed {
  type: 'cloud'
  size: number
  /** Horizontal drift amplitude in target pixels. */
  drift?: number
}

export interface TextContent extends Placed {
  type: 'text'
  text: string
  /** Cap height in target pixels. */
  size: number
  color: string
  background?: string
}

export interface ImageContent extends Placed {
  type: 'image'
  src: string
  /** Display width in target pixels (height follows the image aspect). */
  width: number
}

export interface VideoContent extends Placed {
  type: 'video'
  src: string
  width: number
  loop?: boolean
  /**
   * Lie flat over the printed page (no pop-up or bob) and fade in once the first frame is ready: for an
   * animated version of the page itself, e.g. made by scripts/page-video.py.
   */
  cover?: boolean
  /** Show only part of the clip: [x, y, w, h] as fractions of the frame (e.g. one half of the wraparound cover). */
  crop?: [x: number, y: number, w: number, h: number]
}

/** A page's documentary in a frame matching that page; plays with sound and can go full screen. */
export interface FilmContent extends Placed {
  type: 'film'
  src: string
  /** Still shown until the film's first frame arrives. */
  poster: string
  /** Shown on the caption and in the full-screen player. */
  title: string
  /** Extra caption detail before "Docufilm · m:ss" (e.g. who it's about). */
  subtitle?: string
  /** Frame style: 'stamp' (p15: a perforated postage stamp like p14's), 'flourish' (p24's white baroque corners) or 'script' (p30's white script name). */
  frame: 'stamp' | 'flourish' | 'script'
  /** The caption tab's colour, for frames that have one ('script'; default terracotta). */
  accent?: string
  /**
   * 'script' frame ornament, taken from the page: 'swash' (p30: a clay mat with halftone grain and white
   * script swashes curling round two corners) or 'leaves' (p61: a sage mat with leafy sprigs over two corners).
   */
  decor?: 'swash' | 'leaves'
  /** Overall frame width in target-image pixels. */
  width: number
}

/** A transparent clip from scripts/alpha-clip.py (colour over alpha), e.g. a designer's render on white. */
export interface AlphaVideoContent extends Placed {
  type: 'alpha-video'
  src: string
  /** Display width in target pixels (height follows the clip). */
  width: number
  /** Loop instead of holding the last frame. */
  loop?: boolean
}

export interface ModelContent extends Placed {
  type: 'model'
  /** GLB/glTF URL — exported from Blender as glTF Binary. */
  asset: string
  /** Largest side in page widths (used when `width` isn't given). */
  scale: number
  /** Overall width in target-image pixels (overrides `scale`). */
  width?: number
  /** Degrees from the page: 90 stands it straight up (default), less leans it back towards the page. */
  stand?: number
  /** Node whose base sits on `at` (e.g. the product, over its printed twin). Default: the whole model. */
  anchor?: string
  /** Node names to hide (e.g. leftovers from another scene). */
  hide?: string[]
  /** Extra Euler rotation in degrees. */
  rotation?: [number, number, number]
  /** Only this clip. Omit to play them all: ≤ 3 s ones once (intros), longer ones on a loop. */
  animation?: string
  /** Play every clip once and hold the end (a little story rather than a loop); a tap replays it. */
  once?: boolean
  /** Playback speed (1 = as exported). */
  speed?: number
  /** Stretch along the model's depth (+Z), e.g. 2 to spread a layered diorama's cards further apart. */
  depth?: number
  /** A slow idle sway and bob, so a still scene feels alive. */
  sway?: boolean
}

/** One cut-out garment of a paper doll. Positions are target-image pixels (centres). */
export interface PaperDollPiece {
  id: string
  /** Transparent cut-out, cropped to the piece. */
  src: string
  /** Where it's printed on the page, and its printed width. */
  home: Px
  width: number
  /** Where its centre sits when worn, and its scale there (pieces are cut close to the doll's size). */
  worn: Px
  wornScale: number
  /** One piece per slot: a new outfit replaces the current one but leaves the shoes on. */
  slot: 'outfit' | 'shoes'
}

/** p39's paper doll: drag (or tap) the printed clothes onto the doll (see content/paperDoll.ts). */
export interface PaperDollContent {
  type: 'paper-doll'
  id: string
  /** The page art without its clothes, covering the printed page. */
  cover: string
  /** A little paper note floating above the page, telling the reader what to do. */
  note?: { title: string; hint: string }
  /** Drop zone over the doll: [x, y, w, h] in target-image pixels. */
  body: [x: number, y: number, w: number, h: number]
  pieces: PaperDollPiece[]
  lift?: number
}

/** One printed bee that flies: its cut-out layers (made by cutting it out of the page) and its flight loop. */
export interface FlyingBee {
  body: string
  wings: string
  /** The clean page under it, shown once it takes off (omit when something else already shows the page
   *  without it, e.g. the covers' clip). */
  spot?: string
  /** Centre and width of the cut-out on the page (target-image pixels). */
  at: Px
  width: number
  /** Where the wings join the body, as fractions of the cut-out (0..1, from its top-left). */
  hinge: [number, number]
  /** Centre and radii (x, y) of its flight loop, in target-image pixels. */
  orbit: Px
  radius: [number, number]
  /** The drawing faces right (default: left). */
  facesRight?: boolean
  delay?: number
  /** Buzz pitch (1 = normal; smaller bees higher). */
  pitch?: number
}

/**
 * Content for the page that sits beside this one when both are in view, e.g. the back cover next to the
 * front when the whole wraparound cover is shown (the tracker only ever follows one page). It appears once
 * the camera actually sees that page there: its `probe` colours match what's on screen.
 */
export interface BesideContent {
  type: 'beside'
  id: string
  /** Where the other page's top-left falls, in this page's pixels (same scale, upright). */
  offset: Px
  /** Flat spots on the other page (its pixels) and their printed colour (sRGB 0–255). */
  probe: [x: number, y: number, r: number, g: number, b: number][]
  /** The other page's content, positioned in its own pixels. */
  content: ContentItem[]
}

/** p16's bee species: the printed bees take off and fly round the page (see content/bees.ts). */
export interface BeesContent {
  type: 'bees'
  id: string
  bees: FlyingBee[]
}

/** p58's pan on the flame, with the printed stove knob made turnable (see content/pangat.ts). */
export interface PangatContent extends Placed {
  type: 'pangat'
  /** The pan GLB, with its two food cards (Empty.004 lechon, Empty.006 paksiw). */
  asset: string
  /** The pot body's width (handle not included), in target-image pixels; `at` is its bottom centre. */
  width: number
  /** Degrees from the page (90 = upright). */
  stand?: number
  /** The printed knob: centre and radius in target-image pixels. */
  knob: { at: Px; radius: number }
  /** Where the "turn the knob" note floats (y in target-image pixels; below the page by default). */
  hintY?: number
}

/** p34's ice cream tub: tap to open it and find a fish instead (see content/tub.ts). */
export interface TubContent extends Placed {
  type: 'tub'
  /** The tub GLB (with nodes box_mesh, Empty.001 lid, Sphere.00x scoops, Medeka fish). */
  asset: string
  /** The tub's length on the page (it lies lengthways, top to bottom), in target-image pixels. */
  length: number
}

/**
 * An animation rebuilt from a designer's reference render (see scripts/extract-page13.py): a short
 * take-off clip with its own alpha, then rigid sprites replaying measured per-frame poses. Positions
 * come from the timeline file, already registered to the page.
 */
export interface TimelineContent {
  type: 'timeline'
  id: string
  /** URL of the timeline JSON written by the extraction script. */
  src: string
  /** Resting height per layer id once it has landed (fraction of page width). Defaults by kind. */
  lift?: Record<string, number>
  /** Text of each speech bubble by layer id: the alt text of its tap-to-read card. */
  captions?: Record<string, string>
  /**
   * When this target is a crop of the page the timeline was registered to: the crop's rect on that
   * page, in its pixels ([x, y, w, h] on public/magazine/pNN.webp).
   */
  region?: [x: number, y: number, w: number, h: number]
}

export interface AudioContent {
  type: 'audio'
  id: string
  src: string
  loop?: boolean
  volume?: number
}

export type ContentItem =
  | CutoutContent
  | StarContent
  | HeartContent
  | CloudContent
  | TextContent
  | ImageContent
  | VideoContent
  | FilmContent
  | ModelContent
  | TubContent
  | PaperDollContent
  | PangatContent
  | BeesContent
  | BesideContent
  | TimelineContent
  | AlphaVideoContent
  | AudioContent

export interface TargetConfig {
  id: string
  /** Index of this image inside the compiled .mind file (compile order). */
  targetIndex: number
  title: string
  /** Source artwork; also used by the compiler page and for poster crops. */
  image: string
  /** Pixel size of `image`. */
  size: [width: number, height: number]
  content: ContentItem[]
  /**
   * Build this page's content in the background after scanning starts (default true). Set false for
   * pages with large videos/models so they only download when that page is actually scanned.
   */
  prefetch?: boolean
  /**
   * Targets sharing a group share one intro clock: e.g. a whole page and a close-up crop of it, so
   * moving the phone closer swaps trackers without restarting the animation.
   */
  group?: string
  /** Burst of particles where the user taps. */
  tapBurst?: { colors: string[] }
  /**
   * Pose smoothing for this page, over the app's defaults: e.g. a lower `minCutoff` holds tall content
   * steadier (its far end magnifies tracking jitter), at the cost of a little lag when the page moves.
   */
  poseFilter?: { minCutoff?: number; beta?: number }
}

export interface ExperienceConfig {
  /** Compiled MindAR file containing every target, in targetIndex order. */
  mindFile: string
  targets: TargetConfig[]
}
