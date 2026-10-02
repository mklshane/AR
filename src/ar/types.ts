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
  | ModelContent
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
  /** Burst of particles where the user taps. */
  tapBurst?: { colors: string[] }
}

export interface ExperienceConfig {
  /** Compiled MindAR file containing every target, in targetIndex order. */
  mindFile: string
  targets: TargetConfig[]
}
