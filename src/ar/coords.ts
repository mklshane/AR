import type { Px } from './types'

/**
 * MindAR anchor space: the target image spans x ∈ [-0.5, 0.5] (1 unit = page width), centred at the
 * origin, y up, z out of the page towards the camera. Config positions are image pixels (y down).
 */
export class PageSpace {
  readonly width: number
  readonly height: number

  constructor(size: [number, number]) {
    ;[this.width, this.height] = size
  }

  /** Pixel length → anchor units. */
  len(px: number): number {
    return px / this.width
  }

  /** Pixel point → anchor-space (x, y). Points outside the image are fine — content may overhang. */
  point([x, y]: Px): [number, number] {
    return [x / this.width - 0.5, (this.height / 2 - y) / this.width]
  }
}
