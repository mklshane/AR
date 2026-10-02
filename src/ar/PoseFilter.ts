import * as THREE from 'three'

/**
 * Smooths a target pose: steady when the phone is held still, smooth while it moves, and quick to
 * catch up after a sudden jolt.
 *
 * Why not MindAR's filter: it runs a One Euro filter on each of the 16 matrix elements separately,
 * so rotation and translation settle at different rates and the blend isn't a pure rotation. Content
 * lifted off the page swings and shears.
 *
 * How this works. Each tracker sample is split into three channels (lateral position, depth along
 * the view ray, rotation), each with a live estimate of the tracker's noise σ (typical raw change per
 * sample, robust to outliers), so a noisy laptop
 * thumbnail and a clean print both get appropriate smoothing. Per channel:
 *   - Continuous motion: a One Euro-style filter whose cutoff rises with how fast the *raw* pose is
 *     moving beyond its noise level. Held still → minCutoff (steady). Moving → looser, so no lag
 *     and no stick-slip stutter.
 *   - Jolts: if the raw pose lands > motionSigma·σ from what's on screen for two samples in a row
 *     (one-sample tracker glitches are ignored), snap at maxCutoff until caught up. A jolt in any
 *     channel re-syncs all three, so depth/tilt never creep behind.
 * Depth is the noisiest for a single camera, which is why it has its own σ.
 *
 * Applied once per tracker sample (not interpolated): the camera image only changes per frame too,
 * and blending between samples just makes content trail it.
 */
export interface PoseFilterOptions {
  /** Hz cutoff when held still. Lower = steadier. */
  minCutoff: number
  /** Hz cutoff while catching up after a jolt. */
  maxCutoff: number
  /** Hz added per σ-per-sample of real (beyond-noise) speed. Higher = less lag while moving. */
  beta: number
  /** Catch-up ends once within this many σ. */
  noiseSigma: number
  /** A jump bigger than this many σ (two samples running) is a jolt. */
  motionSigma: number
}

export const DEFAULT_POSE_FILTER: PoseFilterOptions = {
  minCutoff: 0.4,
  maxCutoff: 30,
  beta: 2,
  noiseSigma: 3,
  motionSigma: 12,
}

interface NoiseCfg {
  prior: number
  min: number
  max: number
}
// Starting / floor / ceiling noise σ per channel (page widths, page widths, radians). The floors
// keep "noise" at least ~1 screen pixel for a typical framing.
const NOISE: Record<'lateral' | 'depth' | 'rotation', NoiseCfg> = {
  lateral: { prior: 0.004, min: 0.002, max: 0.03 },
  depth: { prior: 0.02, min: 0.008, max: 0.15 },
  rotation: { prior: 0.006, min: 0.003, max: 0.05 },
}
/** Seconds over which the noise estimate adapts. */
const NOISE_TAU = 1.5
/** Raw steps above this many σ are clipped when learning σ. */
const NOISE_CLIP = 2.5
/** Per-sample raw change (in σ) still considered noise; speed beyond this counts as motion. */
const NOISE_STEP = 1.5
/** Smoothing of the speed estimate (Hz). */
const SPEED_CUTOFF = 4

const alpha = (dt: number, cutoff: number) => {
  const r = 2 * Math.PI * cutoff * dt
  return r / (r + 1)
}

class Channel {
  /** Typical raw change per sample from noise alone (robust running estimate). */
  sigma: number
  /** True on the sample where this channel first detected a jolt. */
  started = false
  private cfg: NoiseCfg
  private speed = 0
  private wasFar = false
  private catchingUp = false
  private calm = 0

  constructor(cfg: NoiseCfg) {
    this.cfg = cfg
    this.sigma = cfg.prior
  }

  /**
   * Cutoff (Hz) for this sample.
   * @param deviation distance from the displayed pose to the new raw sample
   * @param rawStep distance between this raw sample and the previous raw sample
   */
  cutoff(deviation: number, rawStep: number, dt: number, o: PoseFilterOptions): number {
    // Noise scale from raw sample-to-sample change, clipped so jolts/fast moves barely affect it.
    // Deliberately independent of the still/moving decision below (no feedback loop).
    const clipped = Math.min(rawStep, NOISE_CLIP * this.sigma)
    this.sigma += (1 - Math.exp(-dt / NOISE_TAU)) * (clipped - this.sigma)
    this.sigma = Math.min(this.cfg.max, Math.max(this.cfg.min, this.sigma))
    const s = this.sigma

    // Speed beyond noise, in σ per sample, lightly smoothed so a single noisy sample can't open it.
    const excess = Math.max(0, rawStep / s - NOISE_STEP)
    this.speed += alpha(dt, SPEED_CUTOFF) * (excess - this.speed)

    // Jolt: far from the displayed pose two samples running.
    const far = deviation > o.motionSigma * s
    this.started = far && this.wasFar && !this.catchingUp
    this.wasFar = far
    if (this.started) this.latch()
    else if (this.catchingUp) {
      this.calm = deviation < o.noiseSigma * s ? this.calm + 1 : 0
      if (this.calm >= 2) this.catchingUp = false
    }

    if (this.catchingUp) return o.maxCutoff
    return Math.min(o.maxCutoff, o.minCutoff + o.beta * this.speed)
  }

  /** Start catching up (also called when another channel detects a jolt). */
  latch() {
    this.catchingUp = true
    this.calm = 0
  }

  reset() {
    this.speed = 0
    this.wasFar = false
    this.catchingUp = false
    this.calm = 0
  }
}

export class PoseFilter {
  /** Tracker samples received (for the ?hud sample-rate readout). */
  samples = 0
  private opts: PoseFilterOptions
  private pos = new THREE.Vector3()
  private quat = new THREE.Quaternion()
  private prevRawPos = new THREE.Vector3()
  private prevRawQuat = new THREE.Quaternion()
  private lastT = 0
  private initialized = false
  private lateral = new Channel(NOISE.lateral)
  private depth = new Channel(NOISE.depth)
  private rotation = new Channel(NOISE.rotation)
  private lastMatrix = new THREE.Matrix4()
  private rawPos = new THREE.Vector3()
  private rawQuat = new THREE.Quaternion()
  private rawScale = new THREE.Vector3()
  private view = new THREE.Vector3()
  private delta = new THREE.Vector3()
  private step = new THREE.Vector3()
  private out = new THREE.Matrix4()

  constructor(opts: PoseFilterOptions = DEFAULT_POSE_FILTER) {
    this.opts = opts
  }

  /** Call when the target is (re)acquired. Learned noise levels are kept. */
  reset() {
    this.initialized = false
    ;[this.lateral, this.depth, this.rotation].forEach((c) => c.reset())
  }

  /** Feed a tracker sample (page → camera matrix) taken at time `t` seconds. */
  push(matrix: THREE.Matrix4, t: number) {
    // MindAR re-reports identical poses when it re-processes an unchanged camera frame.
    if (this.initialized && this.lastMatrix.equals(matrix)) return
    this.lastMatrix.copy(matrix)
    this.samples++
    matrix.decompose(this.rawPos, this.rawQuat, this.rawScale)

    if (!this.initialized) {
      this.pos.copy(this.rawPos)
      this.quat.copy(this.rawQuat)
      this.prevRawPos.copy(this.rawPos)
      this.prevRawQuat.copy(this.rawQuat)
      this.lastT = t
      this.initialized = true
      this.out.compose(this.pos, this.quat, this.rawScale)
      return
    }

    const dt = Math.min(0.25, Math.max(1e-3, t - this.lastT))
    this.lastT = t
    const width = Math.abs(this.rawScale.x) || 1 // camera units per page width
    const view = this.view.copy(this.pos).normalize()

    // Split vectors into "along the view ray" (depth) and "across it" (lateral), in page widths.
    const split = (v: THREE.Vector3) => {
      const along = v.dot(view)
      return { along, lateral: v.addScaledVector(view, -along) }
    }
    const raw = split(this.step.copy(this.rawPos).sub(this.prevRawPos))
    const rawStepLat = raw.lateral.length() / width
    const rawStepDepth = Math.abs(raw.along) / width
    const dev = split(this.delta.copy(this.rawPos).sub(this.pos))

    const o = this.opts
    let cLat = this.lateral.cutoff(dev.lateral.length() / width, rawStepLat, dt, o)
    let cDepth = this.depth.cutoff(Math.abs(dev.along) / width, rawStepDepth, dt, o)
    let cRot = this.rotation.cutoff(this.quat.angleTo(this.rawQuat), this.prevRawQuat.angleTo(this.rawQuat), dt, o)
    const channels = [this.lateral, this.depth, this.rotation]
    if (channels.some((c) => c.started)) {
      channels.forEach((c) => c.latch())
      cLat = cDepth = cRot = o.maxCutoff
    }

    this.pos.addScaledVector(dev.lateral, alpha(dt, cLat)).addScaledVector(view, dev.along * alpha(dt, cDepth))
    this.quat.slerp(this.rawQuat, alpha(dt, cRot))
    this.prevRawPos.copy(this.rawPos)
    this.prevRawQuat.copy(this.rawQuat)
    this.out.compose(this.pos, this.quat, this.rawScale)
  }

  /** The current smoothed pose. */
  sample(out: THREE.Matrix4): THREE.Matrix4 {
    return out.copy(this.out)
  }

  /** Learned tracker noise per channel (for debugging/tuning). */
  get noise() {
    return { lateral: this.lateral.sigma, depth: this.depth.sigma, rotation: this.rotation.sigma }
  }
}
