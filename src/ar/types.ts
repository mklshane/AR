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
  /** Frame style: 'hex' (p15's hexagon photo crops), 'flourish' (p24's white baroque corners) or 'script' (p30's white script name). */
  frame: 'hex' | 'flourish' | 'script'
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
  /** Uniform scale applied after the model is normalised to the page width. */
  scale: number
  /** Euler rotation in degrees. */
  rotation?: [number, number, number]
  /** Animation clip name to loop. Omit to play the first clip (if any). */
  animation?: string
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
  /** One piece per slot: a new outfit replaces the current one. Shoes stay on once worn. */
  slot: 'outfit' | 'shoes'
}

/** p39's paper doll: drag (or tap) the printed clothes onto the doll (see content/paperDoll.ts). */
export interface PaperDollContent {
  type: 'paper-doll'
  id: string
  /** The page art without its clothes, covering the printed page. */
  cover: string
  /** Drop zone over the doll: [x, y, w, h] in target-image pixels. */
  body: [x: number, y: number, w: number, h: number]
  pieces: PaperDollPiece[]
  lift?: number
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
}

export interface ExperienceConfig {
  /** Compiled MindAR file containing every target, in targetIndex order. */
  mindFile: string
  targets: TargetConfig[]
}
