import * as THREE from 'three'
import type { AssetManager } from '../AssetManager'
import type { PageSpace } from '../coords'

export interface BuildContext {
  assets: AssetManager
  page: PageSpace
  /** Source image of the current target (for poster crops). */
  targetImage: string
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
  /** Called when the user taps this node's object. */
  onTap?(): void
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
