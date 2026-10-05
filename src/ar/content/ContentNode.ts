import * as THREE from 'three'
import type { AssetManager } from '../AssetManager'
import type { PageSpace } from '../coords'

export interface BuildContext {
  assets: AssetManager
  page: PageSpace
  /** Source image of the current target (for poster crops). */
  targetImage: string
  view: ViewServices
}

/** What content may ask of the live AR view. Implemented by ARManager. */
export interface ViewServices {
  /** The AR view's camera (zoom included), for content that sizes itself to the screen. */
  camera: THREE.PerspectiveCamera
  /** A soft studio reflection map for lit (PBR) models, made on first use and shared. */
  environment(): THREE.Texture
  /** Median camera-feed colour (sRGB) under these world-space points, or null if none are on screen. */
  sampleCamera(points: THREE.Vector3[]): THREE.Color | null
  /** Show a card over the camera, e.g. a fruit with its speech bubble, large enough to read. */
  openCard(card: CardSpec): void
  /** A film came into view (or left: null), so the UI can offer sound and full-screen controls. */
  setFilm(film: FilmHandle | null): void
}

/** A film playing on a page, which the UI may take full-screen (the same element, so time carries over). */
export interface FilmHandle {
  video: HTMLVideoElement
  title: string
  /** Sound on/off (a tap, so unmuting is allowed). */
  toggleSound(): void
  /** Move the film into a full-screen player's slot, with sound; it keeps playing off the page. */
  enterPlayer(slot: HTMLElement): void
  /** Back to the AR card: carries on there if the page is in view, otherwise waits for it. */
  exitPlayer(): void
}

/** Images laid out in a box; rects are [x, y, w, h] in fractions of the box width (so y spans 0..aspect). */
export interface CardSpec {
  alt: string
  aspect: number
  items: {
    src: string
    role: 'fruit' | 'bubble'
    rect: [x: number, y: number, w: number, h: number]
    /** Where it grows from, as fractions of its own size (a bubble grows from its tail). */
    origin: [x: number, y: number]
  }[]
}

/** Per-frame timing passed to every node. `t` = seconds since the target was (re)found. */
export interface Tick {
  t: number
  dt: number
  /** Wall-clock seconds, for idle loops that shouldn't restart on re-detection. */
  time: number
}

/** A piece of AR content attached to a target anchor. */
export interface ContentNode {
  object: THREE.Object3D
  update(tick: Tick): void
  /** Called when the user taps this node's object; `hit` says which mesh. */
  onTap?(hit: THREE.Intersection): void
  /** Called when the target is found again (replay intro, resume media). */
  onShow?(): void
  /** Called when the target is lost (pause media). */
  onHide?(): void
  dispose(): void
}

export const easeOutBack = (x: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** Intro progress 0→1 starting at `delay`, lasting `duration` seconds. */
export const intro = (t: number, delay = 0, duration = 0.7) => clamp01((t - delay) / duration)

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh
    mesh.geometry?.dispose()
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
    else mat?.dispose()
  })
}

/** One-shot reaction animation (e.g. on tap): `value(time)` runs 0→1 over `duration`, else 0 at rest. */
export class Pulse {
  private start = -Infinity
  private readonly duration: number

  constructor(duration: number) {
    this.duration = duration
  }

  trigger(time: number) {
    this.start = time
  }

  /** 0..1 progress while active; 0 when idle. */
  value(time: number): number {
    const p = (time - this.start) / this.duration
    return p >= 0 && p < 1 ? p : 0
  }
}
