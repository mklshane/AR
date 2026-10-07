import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { AudioContent, ImageContent, ModelContent, TextContent, VideoContent } from '../types'
import { type BuildContext, type ContentNode, disposeObject, easeOutBack, intro } from './ContentNode'

function floatingPlane(
  map: THREE.Texture,
  w: number,
  h: number,
  at: [number, number],
  lift: number,
  delay: number | undefined,
): ContentNode {
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
  const group = new THREE.Group()
  group.position.set(at[0], at[1], 0)
  group.add(mesh)
  return {
    object: group,
    update({ t, time }) {
      const p = intro(t, delay)
      mesh.position.z = lift * easeOutBack(p) + Math.sin(time * 1.4) * 0.006 * p
      mesh.scale.setScalar(Math.max(0.001, easeOutBack(p)))
    },
    dispose: () => disposeObject(group),
  }
}

export async function buildText(c: TextContent, { page, assets }: BuildContext): Promise<ContentNode> {
  const fontPx = 96
  const font = `900 ${fontPx}px Fraunces, Georgia, serif`
  const probe = document.createElement('canvas').getContext('2d')!
  probe.font = font
  const pad = fontPx * 0.4
  const cw = Math.ceil(probe.measureText(c.text).width + pad * 2)
  const ch = Math.ceil(fontPx * 1.5)
  await document.fonts?.load(font).catch(() => undefined)
  const map = await assets.canvasTexture(`text:${c.text}:${c.color}:${c.background}`, cw, ch, (ctx) => {
    if (c.background) {
      ctx.fillStyle = c.background
      ctx.beginPath()
      ctx.roundRect(0, 0, cw, ch, ch * 0.2)
      ctx.fill()
    }
    ctx.font = font
    ctx.fillStyle = c.color
    ctx.textBaseline = 'middle'
    ctx.fillText(c.text, pad, ch / 2 + fontPx * 0.05)
  })
  const h = page.len(c.size) * 1.5
  return floatingPlane(map, (h * cw) / ch, h, page.point(c.at), c.lift ?? 0.08, c.delay)
}

export async function buildImage(c: ImageContent, { page, assets }: BuildContext): Promise<ContentNode> {
  const map = await assets.texture(c.src)
  const img = map.image as HTMLImageElement
  const w = page.len(c.width)
  return floatingPlane(map, w, (w * img.height) / img.width, page.point(c.at), c.lift ?? 0.06, c.delay)
}

/** A page-sized clip lying on the page: fades in on its first frame and plays while the page is in view. */
function videoCover(c: VideoContent, video: HTMLVideoElement, map: THREE.VideoTexture, w: number, at: [number, number]): ContentNode {
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, toneMapped: false })
  const [cx, cy, cw, ch] = c.crop ?? [0, 0, 1, 1]
  map.repeat.set(cw, ch)
  map.offset.set(cx, 1 - cy - ch)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, (w * video.videoHeight * ch) / (video.videoWidth * cw)), mat)
  mesh.position.set(at[0], at[1], c.lift ?? 0.0005)
  let shownAt = -1
  return {
    object: mesh,
    update({ t }) {
      if (shownAt < 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) shownAt = t
      mat.opacity = shownAt < 0 ? 0 : Math.min(1, (t - shownAt) / 0.4)
    },
    onShow: () => void video.play().catch(() => undefined),
    onHide: () => video.pause(),
    dispose: () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
      map.dispose()
      disposeObject(mesh)
    },
  }
}

export async function buildVideo(c: VideoContent, { page }: BuildContext): Promise<ContentNode> {
  const video = document.createElement('video')
  // Muted + inline is what lets iOS Safari autoplay; the user taps the video to turn sound on.
  Object.assign(video, { loop: c.loop ?? true, muted: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' })
  video.setAttribute('playsinline', '')
  video.setAttribute('muted', '')
  video.src = c.src
  await new Promise<void>((resolve, reject) => {
    if (video.readyState >= 1) return resolve()
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error(`Could not load video ${c.src}`))
    // iOS may not fetch metadata until playback is requested.
    video.play().catch(() => undefined)
  })
  const map = new THREE.VideoTexture(video)
  map.colorSpace = THREE.SRGBColorSpace
  const w = page.len(c.width)
  if (c.cover) return videoCover(c, video, map, w, page.point(c.at))
  const node = floatingPlane(map, w, (w * video.videoHeight) / video.videoWidth, page.point(c.at), c.lift ?? 0.01, c.delay)
  return {
    ...node,
    onShow: () => void video.play().catch(() => undefined),
    onHide: () => video.pause(),
    onTap: () => {
      // Taps are user gestures, so unmuting is allowed here even on iOS.
      video.muted = !video.muted
      void video.play().catch(() => undefined)
    },
    dispose: () => {
      node.dispose()
      map.dispose()
      video.removeAttribute('src')
      video.load()
    },
  }
}

/**
 * Blender-exported GLB (glTF is Y-up). By default it stands straight up out of the page; `stand` tilts it
 * back towards the page, so a front-facing diorama (flat cards layered along +Z) faces a phone held at a
 * reading angle. Sized so its width is `width` page px (or its largest side ≈ `scale` page widths), with its
 * base centred on `at` — or, with `anchor`, that node's base on `at` (e.g. the product on its printed twin).
 * Short clips (≤ 3 s) are intros that play once; longer ones loop. Tap to replay the intros.
 */
export async function buildModel(c: ModelContent, { page, assets, view }: BuildContext): Promise<ContentNode> {
  const gltf = await assets.gltf(c.asset)
  const model = cloneSkinned(gltf.scene)
  for (const n of c.hide ?? []) {
    const o = model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n))
    if (o) o.visible = false
    else console.warn(`[ar] ${c.asset} has no node "${n}" to hide`)
  }

  // Soft studio reflections, toned down to sit with the camera picture (as for the p34 tub).
  const env = view.environment()
  model.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    for (const m of [mesh.material].flat() as THREE.MeshStandardMaterial[]) {
      if (!m.isMeshStandardMaterial) continue
      m.envMap = env
      m.envMapIntensity = 0.4
      m.color.multiplyScalar(0.88)
    }
  })

  model.updateMatrixWorld(true)
  const box = new THREE.Box3()
  model.traverseVisible((o) => {
    if ((o as THREE.Mesh).isMesh) box.expandByObject(o)
  })
  const size = box.getSize(new THREE.Vector3())
  const norm = c.width ? page.len(c.width) / size.x : c.scale / Math.max(size.x, size.y, size.z, 1e-6)
  // Base point: bottom-centre of the model (or of the anchor node). Standing up, its depth is centred on the
  // page; lying back, its rear (−Z) rests on the page so nothing sinks below it.
  const standRad = THREE.MathUtils.degToRad(c.stand ?? 90)
  const depthOf = (b: THREE.Box3) => THREE.MathUtils.lerp(b.getCenter(new THREE.Vector3()).z, box.min.z, Math.cos(standRad))
  const base = new THREE.Vector3(box.getCenter(new THREE.Vector3()).x, box.min.y, depthOf(box))
  if (c.anchor) {
    const a = model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(c.anchor))
    if (a) {
      const ab = new THREE.Box3().setFromObject(a)
      base.set(ab.getCenter(new THREE.Vector3()).x, ab.min.y, depthOf(ab))
    } else console.warn(`[ar] ${c.asset} has no anchor node "${c.anchor}"`)
  }
  model.position.sub(base)
  // Spread the layers out along depth (scaling about the base, so it still rests on the page).
  const depth = new THREE.Group()
  depth.scale.z = c.depth ?? 1
  depth.add(model)

  // Y-up → out of the page, then lean back by (90 − stand)°.
  const holder = new THREE.Group()
  holder.rotation.x = standRad
  holder.add(depth)
  const [rx, ry, rz] = (c.rotation ?? [0, 0, 0]).map(THREE.MathUtils.degToRad)
  const group = new THREE.Group()
  const [x, y] = page.point(c.at)
  group.position.set(x, y, c.lift ?? 0)
  group.rotation.set(rx, ry, rz)
  group.add(holder)

  const mixer = new THREE.AnimationMixer(model)
  const clips = c.animation ? gltf.animations.filter((a) => a.name === c.animation) : gltf.animations
  if (c.animation && !clips.length) console.warn(`[ar] animation "${c.animation}" not in ${c.asset}`, gltf.animations.map((a) => a.name))
  const intros: THREE.AnimationAction[] = []
  for (const clip of clips) {
    const action = mixer.clipAction(clip)
    if (c.once || clip.duration <= 3) {
      action.setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true
      intros.push(action)
    }
    action.play()
  }
  let started = false

  return {
    object: group,
    update({ t, dt, time }) {
      const p = intro(t, c.delay, 0.8)
      group.scale.setScalar(Math.max(0.001, easeOutBack(p)) * norm)
      if (c.sway) {
        holder.rotation.z = Math.sin(time * 0.6) * 0.035
        holder.rotation.x = standRad + Math.sin(time * 0.45) * 0.04
        holder.position.z = (0.5 + 0.5 * Math.sin(time * 0.9)) * 0.08 * size.y
      }
      // Hold the scene at its first frame until it has popped in.
      if (!started && p > 0) {
        started = true
        intros.forEach((a) => a.reset().play())
      }
      if (started) mixer.update(dt * (c.speed ?? 1))
    },
    onShow() {
      intros.forEach((a) => a.reset().play())
    },
    onTap() {
      intros.forEach((a) => a.reset().play())
    },
    dispose: () => {
      mixer.stopAllAction()
      disposeObject(model)
    },
  }
}

export async function buildAudio(c: AudioContent): Promise<ContentNode> {
  const audio = new Audio(c.src)
  audio.loop = c.loop ?? true
  audio.volume = c.volume ?? 0.8
  return {
    object: new THREE.Group(),
    update() {},
    onShow: () => void audio.play().catch(() => undefined),
    onHide: () => audio.pause(),
    dispose: () => {
      audio.pause()
      audio.src = ''
    },
  }
}
