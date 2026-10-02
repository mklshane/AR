import * as THREE from 'three'
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

export async function buildVideo(c: VideoContent, { page }: BuildContext): Promise<ContentNode> {
  const video = document.createElement('video')
  Object.assign(video, { src: c.src, loop: c.loop ?? true, muted: true, playsInline: true, crossOrigin: 'anonymous' })
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error(`Could not load video ${c.src}`))
  })
  const map = new THREE.VideoTexture(video)
  map.colorSpace = THREE.SRGBColorSpace
  const w = page.len(c.width)
  const node = floatingPlane(map, w, (w * video.videoHeight) / video.videoWidth, page.point(c.at), c.lift ?? 0.04, c.delay)
  return {
    ...node,
    onShow: () => void video.play().catch(() => undefined),
    onHide: () => video.pause(),
    onTap: () => {
      video.muted = !video.muted
    },
    dispose: () => {
      node.dispose()
      map.dispose()
      video.removeAttribute('src')
      video.load()
    },
  }
}

/** Blender-exported GLB. Normalised so its largest side ≈ `scale` page widths, sat on the page. */
export async function buildModel(c: ModelContent, { page, assets }: BuildContext): Promise<ContentNode> {
  const gltf = await assets.gltf(c.asset)
  const model = gltf.scene.clone(true)
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const norm = c.scale / Math.max(size.x, size.y, size.z, 1e-6)
  // Blender is Z-up but glTF export converts to Y-up; stand the model up out of the page (+Z).
  const holder = new THREE.Group()
  holder.rotation.x = Math.PI / 2
  holder.add(model)
  model.position.sub(new THREE.Vector3(box.getCenter(new THREE.Vector3()).x, box.min.y, box.getCenter(new THREE.Vector3()).z))
  const [rx, ry, rz] = (c.rotation ?? [0, 0, 0]).map(THREE.MathUtils.degToRad)
  const group = new THREE.Group()
  const [x, y] = page.point(c.at)
  group.position.set(x, y, c.lift ?? 0)
  group.rotation.set(rx, ry, rz)
  group.add(holder)

  const mixer = new THREE.AnimationMixer(model)
  const clip = c.animation ? THREE.AnimationClip.findByName(gltf.animations, c.animation) : gltf.animations[0]
  if (c.animation && !clip) console.warn(`[ar] animation "${c.animation}" not in ${c.asset}`, gltf.animations.map((a) => a.name))
  if (clip) mixer.clipAction(clip).play()

  return {
    object: group,
    update({ t, dt }) {
      group.scale.setScalar(Math.max(0.001, easeOutBack(intro(t, c.delay))) * norm)
      mixer.update(dt)
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
