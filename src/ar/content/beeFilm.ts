import * as THREE from 'three'
import type { BeeFilmContent } from '../types'
import { type BuildContext, type ContentNode, clamp01, disposeObject, easeOutBack, intro } from './ContentNode'

const INK = '#2e2418'
const HONEY = '#eab33d'
const CREAM = '#fff7e6'

function polygon(ctx: CanvasRenderingContext2D, points: [number, number][]) {
  ctx.beginPath()
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
}

function hex(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  polygon(ctx, Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 3 * i + Math.PI / 6
    return [x + Math.cos(a) * r, y + Math.sin(a) * r] as [number, number]
  }))
}

function makeFrameTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 805
  const ctx = canvas.getContext('2d')!

  // A dark editorial panel with six-sided cuts, echoing the photograph on the printed page.
  polygon(ctx, [[60, 34], [1140, 34], [1182, 106], [1182, 699], [1140, 771], [60, 771], [18, 699], [18, 106]])
  ctx.fillStyle = INK
  ctx.shadowColor = '#160e08aa'
  ctx.shadowBlur = 42
  ctx.shadowOffsetY = 22
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 8
  ctx.strokeStyle = HONEY
  ctx.stroke()

  // The center is transparent; live video sits beneath this illustrated frame.
  ctx.clearRect(66, 146, 1068, 515)
  ctx.strokeStyle = '#ffdf8a'
  ctx.lineWidth = 6
  ctx.strokeRect(64, 144, 1072, 519)

  ctx.textBaseline = 'middle'
  ctx.fillStyle = HONEY
  ctx.font = '800 31px system-ui, sans-serif'
  ctx.fillText('THE HIVE / 01', 89, 91)
  ctx.fillStyle = CREAM
  ctx.font = '700 24px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('QUEEN’S HONEYBEE FARM', 1108, 91)
  ctx.textAlign = 'left'

  ctx.fillStyle = CREAM
  ctx.font = '700 34px system-ui, sans-serif'
  ctx.fillText('A STORY WORTH THE STING', 89, 719)
  // Small gold cells make the frame feel like part of this spread, not a stock video player.
  for (const [x, y, r] of [[49, 170, 23], [1151, 170, 23], [49, 637, 23], [1151, 637, 23]] as const) {
    hex(ctx, x, y, r)
    ctx.fillStyle = HONEY
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = INK
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeSoundTexture(muted: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 330
  canvas.height = 72
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = HONEY
  ctx.font = '800 31px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(muted ? 'TAP FOR SOUND' : 'SOUND ON  ♪', 322, 36)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export async function buildBeeFilm(c: BeeFilmContent, { page }: BuildContext): Promise<ContentNode> {
  const video = document.createElement('video')
  video.playsInline = true
  video.muted = true
  video.preload = 'metadata'
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.src = c.src

  // The browser can start a range request for metadata without downloading the whole documentary.
  await new Promise<void>((resolve, reject) => {
    if (video.readyState >= 1) return resolve()
    video.addEventListener('loadedmetadata', () => resolve(), { once: true })
    video.addEventListener('error', () => reject(new Error(`Could not load video ${c.src}`)), { once: true })
    video.load()
  })

  const group = new THREE.Group()
  const [x, y] = page.point(c.at)
  group.position.set(x, y, c.lift ?? 0.06)

  const width = page.len(c.width)
  const height = width * 805 / 1200
  const videoWidth = width * 1068 / 1200
  const videoHeight = height * 515 / 805
  const videoMap = new THREE.VideoTexture(video)
  videoMap.colorSpace = THREE.SRGBColorSpace
  const videoMat = new THREE.MeshBasicMaterial({ map: videoMap, side: THREE.DoubleSide, toneMapped: false })
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(videoWidth, videoHeight), videoMat)
  picture.position.z = 0.001
  // Fill the window without distorting the film: crop its left/right edges for this slightly taller slot.
  const filmRatio = video.videoWidth / video.videoHeight
  const slotRatio = videoWidth / videoHeight
  const uv = picture.geometry.attributes.uv
  if (filmRatio > slotRatio) {
    const used = slotRatio / filmRatio
    uv.setXY(0, (1 - used) / 2, 1)
    uv.setXY(1, (1 + used) / 2, 1)
    uv.setXY(2, (1 - used) / 2, 0)
    uv.setXY(3, (1 + used) / 2, 0)
  } else {
    const used = filmRatio / slotRatio
    uv.setXY(0, 0, (1 + used) / 2)
    uv.setXY(1, 1, (1 + used) / 2)
    uv.setXY(2, 0, (1 - used) / 2)
    uv.setXY(3, 1, (1 - used) / 2)
  }
  uv.needsUpdate = true
  group.add(picture)

  const frameMap = makeFrameTexture()
  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: frameMap, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
  )
  frame.position.z = 0.003
  group.add(frame)

  let soundMap = makeSoundTexture(true)
  const sound = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 330 / 1200, height * 72 / 805),
    new THREE.MeshBasicMaterial({ map: soundMap, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
  )
  sound.position.set(width * 0.317, -height * 0.391, 0.005)
  group.add(sound)

  let visible = false
  return {
    object: group,
    update({ t, time }) {
      const p = clamp01(intro(t, c.delay, 1.1))
      group.scale.setScalar(Math.max(0.001, easeOutBack(p)))
      group.position.z = (c.lift ?? 0.06) + 0.012 * Math.sin(time * 1.3) * p
      group.rotation.z = Math.sin(time * 0.7) * 0.008 * p
    },
    onShow() {
      visible = true
      void video.play().catch(() => undefined)
    },
    onHide() {
      visible = false
      video.pause()
    },
    onTap() {
      video.muted = !video.muted
      const next = makeSoundTexture(video.muted)
      ;(sound.material as THREE.MeshBasicMaterial).map = next
      ;(sound.material as THREE.MeshBasicMaterial).needsUpdate = true
      soundMap.dispose()
      soundMap = next
      if (visible) void video.play().catch(() => undefined)
    },
    dispose() {
      video.pause()
      video.removeAttribute('src')
      video.load()
      videoMap.dispose()
      frameMap.dispose()
      soundMap.dispose()
      disposeObject(group)
    },
  }
}
