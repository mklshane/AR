import * as THREE from 'three'
import type { TimelineContent } from '../types'
import { type BuildContext, type CardSpec, type ContentNode, clamp01, disposeObject, easeOutBack } from './ContentNode'

type Pose = [cx: number, cy: number, scale: number]

interface Layer {
  id: string
  kind: 'basket' | 'fruit' | 'bubble'
  src: string
  /** Sprite size in video pixels at scale 1. */
  size: [number, number]
  /** Video frame of poses[0]. Fruits start at the swap; bubbles when they start growing. */
  from: number
  poses: Pose[]
  /** Bubbles: the tail tip, as fractions of the sprite's size. */
  tail?: [number, number]
}

/** Written by scripts/extract-page13.py. All geometry is in the reference video's pixels. */
interface Timeline {
  fps: number
  swap: number
  videoToPage: { scale: number; offset: [number, number] }
  clip: { src: string; rect: [number, number, number, number] }
  patch: { src: string; rect: [number, number, number, number] }
  /** Plain paper near the patch, in page px: sampled from the camera to tint the patch like the real page. */
  paper: [number, number][]
  layers: Layer[]
}

const DEFAULT_LIFT = { basket: 0, fruit: 0.035, bubble: 0.07 }
const WHITE = new THREE.Color(1, 1, 1)
/** Seconds for a fruit to rise from the page to its resting height after the swap. */
const RISE = 0.8
/** If the clip hasn't started this long after the page is found, skip straight to the sprites. */
const CLIP_TIMEOUT = 2
/** How often to re-read the paper colour from the camera, in seconds. */
const PAPER_EVERY = 0.25
/** Flat stack just above the paper: patch < clip < basket. */
const Z = { patch: 0.0002, clip: 0.0004, basket: 0.0006 }

/**
 * Replays a designer's reference animation on the page. The take-off (overlapping, stretching fruit)
 * plays as a clip with stacked alpha; at `swap` the clip hands over to sprites that match its last frame
 * exactly, which then rise off the paper while the speech bubbles pop in.
 */
export async function buildTimeline(c: TimelineContent, { page, assets, view }: BuildContext): Promise<ContentNode> {
  const res = await fetch(c.src)
  if (!res.ok) throw new Error(`Could not load timeline ${c.src}`)
  const tl = (await res.json()) as Timeline
  // video px → page px → this target's px (a close-up target is a scaled crop of the page)
  const [rx, ry, rw] = c.region ?? [0, 0, page.width]
  const f = c.region ? page.width / rw : 1
  const k = tl.videoToPage.scale
  const [ox, oy] = tl.videoToPage.offset
  const onPage = (x: number, y: number) => page.point([(x - rx) * f, (y - ry) * f])
  const at = (x: number, y: number) => onPage(k * x + ox, k * y + oy)
  const len = (v: number) => page.len(k * v * f)
  const swapT = tl.swap / tl.fps
  const group = new THREE.Group()

  const placeRect = (mesh: THREE.Mesh, [x, y, w, h]: [number, number, number, number], z: number) => {
    const [px, py] = at(x + w / 2, y + h / 2)
    mesh.position.set(px, py, z)
  }
  const rectPlane = ([, , w, h]: [number, number, number, number]) => new THREE.PlaneGeometry(len(w), len(h))

  // White silhouette of the printed basket + fruits, so the paper version disappears under the AR.
  const patch = new THREE.Mesh(
    rectPlane(tl.patch.rect),
    new THREE.MeshBasicMaterial({ map: await assets.texture(tl.patch.src), transparent: true, depthWrite: false }),
  )
  placeRect(patch, tl.patch.rect, Z.patch)
  patch.renderOrder = -3
  group.add(patch)
  const paperPoints = tl.paper.map(([x, y]) => new THREE.Vector3(...onPage(x, y), 0))
  const paperWorld = paperPoints.map((p) => p.clone())
  const paperTone = new THREE.Color(1, 1, 1)
  let paperAt = -Infinity

  // Take-off clip (colour on top, alpha below), shared with any other target showing this timeline.
  const pb = await Playback.acquire(c.src, tl.clip.src, swapT)
  const clip = new THREE.Mesh(
    rectPlane(tl.clip.rect),
    new THREE.MeshBasicMaterial({ map: pb.colorTex, alphaMap: pb.alphaTex, transparent: true, depthWrite: false }),
  )
  placeRect(clip, tl.clip.rect, Z.clip)
  clip.renderOrder = -1
  group.add(clip)

  // Sprites, each with a soft shadow that slides out as it lifts.
  const sprites = await Promise.all(
    tl.layers.map(async (layer, i) => {
      const map = await assets.texture(layer.src)
      const geo = new THREE.PlaneGeometry(len(layer.size[0]), len(layer.size[1]))
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }))
      const shadow = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ map, color: 0x2a1a0c, transparent: true, opacity: 0, depthWrite: false }),
      )
      // Higher layers draw later: basket, then fruits, then bubbles (each bubble's shadow falls on the fruits).
      const base = layer.kind === 'basket' ? 0 : layer.kind === 'fruit' ? 10 : 20
      mesh.renderOrder = base + i
      shadow.renderOrder = layer.kind === 'bubble' ? base - 1 : -2
      group.add(shadow, mesh)
      return { layer, mesh, shadow, lift: c.lift?.[layer.id] ?? DEFAULT_LIFT[layer.kind], phase: i * 1.7 }
    }),
  )
  const byMesh = new Map<THREE.Object3D, (typeof sprites)[number]>()
  for (const s of sprites) byMesh.set(s.mesh, s).set(s.shadow, s)
  const bubbleOf = (id: string) => sprites.find((s) => s.layer.id === (id.startsWith('bubble-') ? id : `bubble-${id}`))

  const poseAt = (layer: Layer, frame: number): Pose | null => {
    const i = frame - layer.from
    if (i < 0) return null
    const last = layer.poses.length - 1
    if (i >= last) return layer.poses[last]
    const i0 = Math.floor(i)
    const u = i - i0
    const a = layer.poses[i0]
    const b = layer.poses[i0 + 1]
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]
  }

  return {
    object: group,
    update({ t, time }) {
      const { tau, clipLive, landed } = pb.tick(t)
      const frame = tau * tl.fps
      clip.visible = clipLive && !landed
      patch.visible = clipLive || landed

      // Tint the patch like the paper the camera actually sees (white paper reads grey/warm on camera).
      if (patch.visible && time - paperAt > PAPER_EVERY) {
        paperAt = time
        group.updateWorldMatrix(true, false)
        paperWorld.forEach((w, i) => w.copy(paperPoints[i]).applyMatrix4(group.matrixWorld))
        const seen = view.sampleCamera(paperWorld)
        if (seen) paperTone.lerp(seen, paperTone.equals(WHITE) ? 1 : 0.5)
        ;(patch.material as THREE.MeshBasicMaterial).color.copy(paperTone)
      }

      for (const s of sprites) {
        const { layer, mesh, shadow } = s
        // Basket and fruits live in the clip until the swap; bubbles follow their own start frames.
        const pose = layer.kind === 'bubble' || landed ? poseAt(layer, frame) : null
        mesh.visible = shadow.visible = !!pose && pose[2] > 0.01
        if (!pose || !mesh.visible) continue
        const [px, py] = at(pose[0], pose[1])
        let z: number
        let shade: number
        if (layer.kind === 'basket') {
          z = Z.basket
          shade = 0
        } else if (layer.kind === 'fruit') {
          const p = clamp01((tau - swapT) / RISE)
          z = Z.basket + s.lift * easeOutBack(p) + Math.sin(time * 1.3 + s.phase) * 0.002 * p
          shade = p
        } else {
          z = s.lift + Math.sin(time * 1.1 + s.phase) * 0.003
          shade = clamp01(pose[2])
        }
        mesh.position.set(px, py, z)
        mesh.scale.setScalar(pose[2])
        // Light from the upper left, as in the cutout stickers.
        shadow.position.set(px + z * 0.35, py - z * 0.45, Z.basket - 0.0001)
        shadow.scale.setScalar(pose[2])
        ;(shadow.material as THREE.MeshBasicMaterial).opacity = 0.28 * shade
      }
    },
    // Tap a bubble (or its fruit) to read it: the pair opens as a card, laid out as in the scene.
    onTap: (hit) => {
      const s = byMesh.get(hit.object)
      if (!s || !s.mesh.visible) return
      const bubble = s.layer.kind === 'bubble' ? s : bubbleOf(s.layer.id)
      if (!bubble || !bubble.mesh.visible || bubble.mesh.scale.x < 0.5) return
      const fruit = sprites.find((f) => f.layer.kind === 'fruit' && bubble.layer.id === `bubble-${f.layer.id}`)
      view.openCard(cardFor(bubble.layer, fruit?.layer, c.captions?.[bubble.layer.id] ?? bubble.layer.id.replace('bubble-', '')))
    },
    onShow: () => pb.show(),
    onHide: () => pb.hide(),
    dispose: () => {
      disposeObject(group)
      pb.release()
    },
  }
}

/**
 * The take-off clip and the animation clock for one timeline. Shared by every target showing it (a page
 * and its close-up crop), so when the tracker switches between them mid-animation nothing restarts.
 */
class Playback {
  private static all = new Map<string, Playback>()
  readonly video: HTMLVideoElement
  readonly colorTex: THREE.VideoTexture
  readonly alphaTex: THREE.VideoTexture
  private refs = 0
  private shown = 0
  private phase: 'clip' | 'sprites' = 'clip'
  /** Scan time minus animation time once the sprites have taken over (the clip may start late or stall). */
  private lag = 0
  private waitFrom = 0
  private lastT = Infinity
  private readonly key: string
  private readonly swapT: number

  static async acquire(key: string, clipSrc: string, swapT: number): Promise<Playback> {
    let pb = Playback.all.get(key)
    if (!pb) {
      pb = new Playback(key, clipSrc, swapT)
      Playback.all.set(key, pb)
    }
    pb.refs++
    await pb.ready.catch((e) => {
      pb.release()
      throw e
    })
    return pb
  }

  private readonly ready: Promise<void>

  private constructor(key: string, clipSrc: string, swapT: number) {
    this.key = key
    this.swapT = swapT
    const video = document.createElement('video')
    Object.assign(video, { muted: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' })
    video.setAttribute('playsinline', '')
    video.setAttribute('muted', '')
    video.src = clipSrc
    this.video = video
    this.ready = new Promise<void>((resolve, reject) => {
      if (video.readyState >= 1) return resolve()
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error(`Could not load video ${clipSrc}`))
      video.load()
    })
    this.colorTex = new THREE.VideoTexture(video)
    this.colorTex.colorSpace = THREE.SRGBColorSpace
    this.colorTex.repeat.set(1, 0.5)
    this.colorTex.offset.set(0, 0.5)
    this.alphaTex = new THREE.VideoTexture(video)
    this.alphaTex.repeat.set(1, 0.5)
  }

  /** Animation time for scan time t. The clip is the clock while it plays; then scan time, offset by lag. */
  tick(t: number): { tau: number; clipLive: boolean; landed: boolean } {
    // The shared scan clock only drops back when the page is re-found after a while: replay from the basket.
    if (t < this.lastT - 0.25) this.restart(t)
    this.lastT = t
    const { video, swapT } = this
    let tau: number
    let clipLive = false
    if (this.phase === 'clip') {
      clipLive = video.readyState >= 2 && video.currentTime > 0
      if (video.ended || video.currentTime >= swapT || (!clipLive && t - this.waitFrom > CLIP_TIMEOUT)) {
        // Clip done — or autoplay refused / never arrived: show the landed state rather than nothing.
        this.phase = 'sprites'
        this.lag = t - swapT
        video.pause()
        clipLive = false
        tau = swapT
      } else tau = clipLive ? video.currentTime : 0
    } else tau = t - this.lag
    return { tau, clipLive, landed: this.phase === 'sprites' }
  }

  private restart(t: number) {
    this.phase = 'clip'
    this.waitFrom = t
    this.video.currentTime = 0
    if (this.shown) void this.video.play().catch(() => undefined)
  }

  show() {
    this.shown++
    if (this.phase === 'clip') void this.video.play().catch(() => undefined)
  }

  hide() {
    this.shown = Math.max(0, this.shown - 1)
    if (!this.shown) this.video.pause()
  }

  release() {
    if (--this.refs > 0) return
    Playback.all.delete(this.key)
    this.colorTex.dispose()
    this.alphaTex.dispose()
    this.video.removeAttribute('src')
    this.video.load()
  }
}

/** Size of the fruit on a card, relative to its bubble's width. */
const CARD_FRUIT = 0.36

/**
 * A fruit and its bubble composed for reading: the bubble as big as it can be, the fruit tucked against
 * its tail (the tail points at the fruit in the scene, so this keeps them "talking" the same way).
 */
function cardFor(bubble: Layer, fruit: Layer | undefined, alt: string): CardSpec {
  const bh = bubble.size[1] / bubble.size[0] // bubble box: width 1, height bh
  const origin: [number, number] = bubble.tail ?? [0, 1]
  const boxes: { src: string; role: 'fruit' | 'bubble'; r: [number, number, number, number]; origin: [number, number] }[] = []
  if (fruit) {
    // Sit the fruit just past the tail tip, along the line from the bubble's centre through the tail.
    const tail = [origin[0], origin[1] * bh]
    const dir = [tail[0] - 0.5, tail[1] - bh / 2]
    const n = Math.hypot(dir[0], dir[1]) || 1
    const fw = CARD_FRUIT
    const fh = fw * (fruit.size[1] / fruit.size[0])
    const reach = Math.max(fw, fh) * 0.3
    const cx = tail[0] + (dir[0] / n) * reach
    const cy = tail[1] + (dir[1] / n) * reach
    boxes.push({ src: fruit.src, role: 'fruit', r: [cx - fw / 2, cy - fh / 2, fw, fh], origin: [0.5, 0.5] })
  }
  boxes.push({ src: bubble.src, role: 'bubble', r: [0, 0, 1, bh], origin })
  const x0 = Math.min(...boxes.map((b) => b.r[0]))
  const y0 = Math.min(...boxes.map((b) => b.r[1]))
  const x1 = Math.max(...boxes.map((b) => b.r[0] + b.r[2]))
  const y1 = Math.max(...boxes.map((b) => b.r[1] + b.r[3]))
  const W = x1 - x0
  return {
    alt,
    aspect: (y1 - y0) / W,
    items: boxes.map((b) => ({
      src: b.src,
      role: b.role,
      rect: [(b.r[0] - x0) / W, (b.r[1] - y0) / W, b.r[2] / W, b.r[3] / W],
      origin: b.origin,
    })),
  }
}
