import * as THREE from 'three'
import type { TimelineContent } from '../types'
import { type BuildContext, type ContentNode, clamp01, disposeObject, easeOutBack } from './ContentNode'

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
}

/** Written by scripts/extract-page13.py. All geometry is in the reference video's pixels. */
interface Timeline {
  fps: number
  swap: number
  videoToPage: { scale: number; offset: [number, number] }
  clip: { src: string; rect: [number, number, number, number] }
  patch: { src: string; rect: [number, number, number, number] }
  layers: Layer[]
}

const DEFAULT_LIFT = { basket: 0, fruit: 0.035, bubble: 0.07 }
/** Seconds for a fruit to rise from the page to its resting height after the swap. */
const RISE = 0.8
/** If the clip hasn't started this long after the page is found, skip straight to the sprites. */
const CLIP_TIMEOUT = 2
/** Flat stack just above the paper: patch < clip < basket. */
const Z = { patch: 0.0002, clip: 0.0004, basket: 0.0006 }

/**
 * Replays a designer's reference animation on the page. The take-off (overlapping, stretching fruit)
 * plays as a clip with stacked alpha; at `swap` the clip hands over to sprites that match its last frame
 * exactly, which then rise off the paper while the speech bubbles pop in.
 */
export async function buildTimeline(c: TimelineContent, { page, assets }: BuildContext): Promise<ContentNode> {
  const res = await fetch(c.src)
  if (!res.ok) throw new Error(`Could not load timeline ${c.src}`)
  const tl = (await res.json()) as Timeline
  const k = tl.videoToPage.scale
  const [ox, oy] = tl.videoToPage.offset
  const at = (x: number, y: number) => page.point([k * x + ox, k * y + oy])
  const len = (v: number) => page.len(k * v)
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

  // Take-off clip: colour in the top half, alpha (grey) in the bottom half.
  const video = document.createElement('video')
  Object.assign(video, { muted: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' })
  video.setAttribute('playsinline', '')
  video.setAttribute('muted', '')
  video.src = tl.clip.src
  await new Promise<void>((resolve, reject) => {
    if (video.readyState >= 1) return resolve()
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error(`Could not load video ${tl.clip.src}`))
    video.load()
  })
  const colorTex = new THREE.VideoTexture(video)
  colorTex.colorSpace = THREE.SRGBColorSpace
  colorTex.repeat.set(1, 0.5)
  colorTex.offset.set(0, 0.5)
  const alphaTex = new THREE.VideoTexture(video)
  alphaTex.repeat.set(1, 0.5)
  const clip = new THREE.Mesh(
    rectPlane(tl.clip.rect),
    new THREE.MeshBasicMaterial({ map: colorTex, alphaMap: alphaTex, transparent: true, depthWrite: false }),
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

  // The clip is the clock while it plays (it may start late or stall); afterwards scan time takes over
  // from the moment of the swap, so the sprites pick up exactly where the clip left off.
  let phase: 'clip' | 'sprites' = 'clip'
  let lag = 0
  let waitFrom = 0
  let lastT = Infinity
  let shown = false
  const restart = (t: number) => {
    phase = 'clip'
    waitFrom = t
    video.currentTime = 0
    if (shown) void video.play().catch(() => undefined)
  }

  return {
    object: group,
    update({ t, time }) {
      // t drops back towards 0 when the page is re-found after a while: replay from the full basket.
      if (t < lastT - 0.25 || lastT === Infinity) restart(t)
      lastT = t

      let tau: number
      const clipLive = phase === 'clip' && video.readyState >= 2 && video.currentTime > 0
      if (phase === 'clip') {
        if (video.ended || video.currentTime >= swapT) {
          phase = 'sprites'
          lag = t - swapT
          tau = swapT
        } else if (clipLive) {
          tau = video.currentTime
        } else if (t - waitFrom > CLIP_TIMEOUT) {
          // Autoplay refused or the clip never arrived: show the landed state rather than nothing.
          phase = 'sprites'
          lag = t - swapT
          tau = swapT
        } else tau = 0
      } else tau = t - lag

      const frame = tau * tl.fps
      const landed = phase === 'sprites'
      clip.visible = clipLive && !landed
      patch.visible = clipLive || landed
      if (landed && !video.paused) video.pause()

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
    onShow: () => {
      shown = true
      if (phase === 'clip') void video.play().catch(() => undefined)
    },
    onHide: () => {
      shown = false
      video.pause()
    },
    dispose: () => {
      disposeObject(group)
      colorTex.dispose()
      alphaTex.dispose()
      video.removeAttribute('src')
      video.load()
    },
  }
}
