import * as THREE from 'three'

/**
 * Smooths a target pose without distorting it.
 *
 * MindAR's built-in filter runs a One Euro filter on each of the 16 matrix elements separately, so
 * rotation and translation settle at different rates and the blended matrix isn't a pure rotation.
 * Content lifted off the page then swings and shears. Instead we:
 *   1. decompose each tracker sample into position / rotation / scale,
 *   2. One Euro filter each (position in page widths so tuning is distance-independent; rotation as a
 *      quaternion slerp driven by angular speed): heavy smoothing when still, light when moving,
 *   3. at render rate, interpolate between the last two filtered samples, so motion is continuous
 *      instead of stepping at the tracker's ~15–30 Hz.
 */
export interface PoseFilterOptions {
  /** Hz. Lower = steadier when still, but slower to settle. */
  minCutoff: number
  /** How fast smoothing relaxes with speed (per page-width/s). Higher = less lag on fast moves. */
  beta: number
  /** Same, for rotation (speed in rad/s). */
  rotMinCutoff: number
  rotBeta: number
}

// Tuned against ground truth with the fake camera (see README → "Tracking stability"): matches the
// old filter's accuracy with less jitter, and rotation is smoothed hardest because rotation noise
// is what makes lifted content wobble.
export const DEFAULT_POSE_FILTER: PoseFilterOptions = {
  minCutoff: 0.5,
  beta: 0.5,
  rotMinCutoff: 0.2,
  rotBeta: 0.1,
}

/** Cutoff for the speed estimate (Hz). */
const D_CUTOFF = 1.0

const alpha = (dt: number, cutoff: number) => {
  const r = 2 * Math.PI * cutoff * dt
  return r / (r + 1)
}

interface Pose {
  pos: THREE.Vector3
  quat: THREE.Quaternion
  scale: number
  t: number
}

const newPose = (): Pose => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 1, t: 0 })
const copyPose = (to: Pose, from: Pose) => {
  to.pos.copy(from.pos)
  to.quat.copy(from.quat)
  to.scale = from.scale
  to.t = from.t
}

export class PoseFilter {
  private opts: PoseFilterOptions
  private raw = newPose()
  private prevRaw = newPose()
  private filtered = newPose()
  private prevFiltered = newPose()
  private speed = 0
  private rotSpeed = 0
  private scaleSpeed = 0
  private interval = 1 / 30
  private initialized = false
  private tmpScale = new THREE.Vector3()
  private outPose = newPose()
  private lastMatrix = new THREE.Matrix4()

  constructor(opts: PoseFilterOptions = DEFAULT_POSE_FILTER) {
    this.opts = opts
  }

  reset() {
    this.initialized = false
  }

  /** Feed a new tracker sample (page → camera matrix) taken at time `t` seconds. */
  push(matrix: THREE.Matrix4, t: number) {
    // MindAR re-reports the same pose when it re-processes an unchanged camera frame; those aren't
    // new information and would make the speed estimate spike when the next real sample lands.
    if (this.initialized && this.lastMatrix.equals(matrix)) return
    this.lastMatrix.copy(matrix)
    const raw = this.raw
    copyPose(this.prevRaw, raw)
    matrix.decompose(raw.pos, raw.quat, this.tmpScale)
    raw.scale = this.tmpScale.x
    raw.t = t

    if (!this.initialized) {
      copyPose(this.filtered, raw)
      copyPose(this.prevFiltered, raw)
      this.speed = this.rotSpeed = this.scaleSpeed = 0
      this.initialized = true
      return
    }

    const dt = Math.max(1e-3, t - this.prevRaw.t)
    this.interval += 0.1 * (Math.min(dt, 0.2) - this.interval)
    const { minCutoff, beta, rotMinCutoff, rotBeta } = this.opts
    const ad = alpha(dt, D_CUTOFF)
    const f = this.filtered
    // Start the next blend from what is on screen right now, so early samples never cause a jump.
    this.blend(t, this.prevFiltered)

    // Speeds come from consecutive *raw* samples (true One Euro), smoothed so noise doesn't open the filter.
    const width = Math.abs(raw.scale) || 1
    this.speed += ad * (raw.pos.distanceTo(this.prevRaw.pos) / width / dt - this.speed)
    this.rotSpeed += ad * (raw.quat.angleTo(this.prevRaw.quat) / dt - this.rotSpeed)
    this.scaleSpeed += ad * (Math.abs(raw.scale - this.prevRaw.scale) / width / dt - this.scaleSpeed)

    f.pos.lerp(raw.pos, alpha(dt, minCutoff + beta * this.speed))
    f.quat.slerp(raw.quat, alpha(dt, rotMinCutoff + rotBeta * this.rotSpeed))
    f.scale += alpha(dt, minCutoff + beta * this.scaleSpeed) * (raw.scale - f.scale)
    f.t = t
  }

  /** Smoothed pose for render time `now`, interpolated between the last two filtered samples. */
  sample(now: number, out: THREE.Matrix4): THREE.Matrix4 {
    const o = this.blend(now, this.outPose)
    return out.compose(o.pos, o.quat, this.tmpScale.setScalar(o.scale))
  }

  private blend(now: number, o: Pose): Pose {
    const a = this.prevFiltered
    const b = this.filtered
    const u = Math.min(1, Math.max(0, (now - b.t) / this.interval))
    o.pos.lerpVectors(a.pos, b.pos, u)
    o.quat.slerpQuaternions(a.quat, b.quat, u)
    o.scale = a.scale + (b.scale - a.scale) * u
    o.t = now
    return o
  }
}
