import * as THREE from 'three'
import { takeVideo } from '../mediaUnlock'
import type { BeeFilmContent } from '../types'
import { type BuildContext, type ContentNode, type FilmHandle, clamp01, disposeObject, easeOutBack, intro } from './ContentNode'

// The spread's palette: brown ink headline, white paper gutters, the farm's honey yellow.
const INK = '#2e2418'
const HONEY = '#e2a72e'
const PAPER = '#ffffff'

const TITLE = 'Queen’s Honeybee Farm'

// Frame canvas layout (px). The film window is a pointy-ended hexagon like the page's photo crops.
const CW = 1200
const CH = 860
const WIN = { x: 70, y: 40, w: 1060, h: 596 } // 16:9 window
const SLANT = WIN.h / 2 / Math.tan(Math.PI / 3) // 60° sides, as on the page
const BORDER = 18

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, grow = 0) {
  const s = SLANT + grow * Math.tan(Math.PI / 6)
  const [l, t, r, b] = [x - grow, y - grow, x + w + grow, y + h + grow]
  ctx.beginPath()
  ctx.moveTo(l, (t + b) / 2)
  ctx.lineTo(l + s, t)
  ctx.lineTo(r - s, t)
  ctx.lineTo(r, (t + b) / 2)
  ctx.lineTo(r - s, b)
  ctx.lineTo(l + s, b)
  ctx.closePath()
}

async function makeFrameTexture(duration: number): Promise<THREE.CanvasTexture> {
  await Promise.all(['600 30px Montserrat', '500 30px Montserrat'].map((f) => document.fonts?.load(f).catch(() => undefined)))
  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = CH
  const ctx = canvas.getContext('2d')!
  const { x, y, w, h } = WIN

  // White paper border with a soft shadow, as if this photo panel had lifted off the page.
  ctx.save()
  ctx.shadowColor = 'rgba(46, 36, 24, 0.35)'
  ctx.shadowBlur = 36
  ctx.shadowOffsetY = 18
  hexPath(ctx, x, y, w, h, BORDER)
  ctx.fillStyle = PAPER
  ctx.fill()
  ctx.restore()

  // Caption tab, tucked under the bottom-left of the panel.
  const tab = { x: x + SLANT * 0.55, y: y + h + BORDER - 6, w: 470, h: 112 }
  ctx.save()
  ctx.shadowColor = 'rgba(46, 36, 24, 0.25)'
  ctx.shadowBlur = 20
  ctx.shadowOffsetY = 10
  ctx.beginPath()
  ctx.moveTo(tab.x, tab.y)
  ctx.lineTo(tab.x + tab.w, tab.y)
  ctx.lineTo(tab.x + tab.w - 34, tab.y + tab.h) // one slanted end, echoing the hexagons
  ctx.lineTo(tab.x, tab.y + tab.h)
  ctx.closePath()
  ctx.fillStyle = PAPER
  ctx.fill()
  ctx.restore()
  // Re-cover the tab's shadow where it overlaps the panel.
  hexPath(ctx, x, y, w, h, BORDER)
  ctx.fillStyle = PAPER
  ctx.fill()

  // Punch out the film window and edge it with a honey keyline.
  ctx.globalCompositeOperation = 'destination-out'
  hexPath(ctx, x, y, w, h)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  hexPath(ctx, x, y, w, h, 3)
  ctx.lineWidth = 6
  ctx.strokeStyle = HONEY
  ctx.stroke()

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = HONEY
  ctx.font = '600 25px Montserrat, system-ui, sans-serif'
  ctx.letterSpacing = '3px'
  ctx.fillText(TITLE.toUpperCase(), tab.x + 30, tab.y + 50)
  ctx.letterSpacing = '0px'
  ctx.fillStyle = INK
  ctx.font = '500 30px Montserrat, system-ui, sans-serif'
  const mins = Math.floor(duration / 60)
  const secs = String(Math.round(duration % 60)).padStart(2, '0')
  ctx.fillText(`Docufilm · ${mins}:${secs}`, tab.x + 30, tab.y + 90)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** White hexagon on black: cuts the rectangular film down to the window's shape. */
function makeWindowMask(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = Math.round((512 * WIN.h) / WIN.w)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(canvas.width / WIN.w, canvas.height / WIN.h)
  hexPath(ctx, 0, 0, WIN.w, WIN.h, 4) // a touch larger, tucked under the keyline
  ctx.fillStyle = '#fff'
  ctx.fill()
  return new THREE.CanvasTexture(canvas)
}

export async function buildBeeFilm(c: BeeFilmContent, { page, assets, view }: BuildContext): Promise<ContentNode> {
  // Borrow a video element unlocked by the "Open camera" tap, so the film can start with its sound.
  const { video, unlocked } = takeVideo()
  video.muted = true
  video.preload = 'metadata'
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
  const height = (width * CH) / CW
  const px = width / CW // canvas px → anchor units
  // Canvas (y down, origin top-left) → plane coordinates (y up, origin at the frame's centre).
  const cx = (u: number) => (u - CW / 2) * px
  const cy = (v: number) => (CH / 2 - v) * px

  const videoMap = new THREE.VideoTexture(video)
  videoMap.colorSpace = THREE.SRGBColorSpace
  const posterMap = await assets.texture('/ar/p15/poster.webp')
  const mask = makeWindowMask()
  const videoMat = new THREE.MeshBasicMaterial({ map: posterMap, alphaMap: mask, transparent: true, side: THREE.DoubleSide, toneMapped: false })
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w * px, WIN.h * px), videoMat)
  picture.position.set(cx(WIN.x + WIN.w / 2), cy(WIN.y + WIN.h / 2), 0.001)
  // Fill the window without distorting the film (crop whichever edges overflow).
  const filmRatio = video.videoWidth / video.videoHeight
  const slotRatio = WIN.w / WIN.h
  const uv = picture.geometry.attributes.uv
  if (filmRatio > slotRatio) {
    const used = slotRatio / filmRatio
    for (const [i, u, v] of [[0, 0, 1], [1, 1, 1], [2, 0, 0], [3, 1, 0]] as const) uv.setXY(i, (1 - used) / 2 + u * used, v)
  } else {
    const used = filmRatio / slotRatio
    for (const [i, u, v] of [[0, 0, 1], [1, 1, 1], [2, 0, 0], [3, 1, 0]] as const) uv.setXY(i, u, (1 - used) / 2 + v * used)
  }
  uv.needsUpdate = true
  group.add(picture)

  const frameMap = await makeFrameTexture(video.duration || 0)
  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: frameMap, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
  )
  frame.position.z = 0.003
  group.add(frame)

  let visible = false
  let watching = false
  const play = () => {
    // Sound on where the browser allows it (an unlocked element); otherwise start muted.
    if (unlocked && !watching) video.muted = false
    video.play().catch(() => {
      video.muted = true
      void video.play().catch(() => undefined)
    })
  }
  const film: FilmHandle = {
    video,
    title: TITLE,
    toggleSound() {
      video.muted = !video.muted
      void video.play().catch(() => undefined)
    },
    enterPlayer(slot) {
      watching = true
      video.controls = true
      video.className = 'h-full w-full object-contain'
      slot.appendChild(video)
      // Opening the player is a tap, so sound is allowed here even on iOS.
      video.muted = false
      void video.play().catch(() => undefined)
    },
    exitPlayer() {
      watching = false
      video.controls = false
      video.removeAttribute('class')
      video.remove()
      // Leaving the document pauses it, just after this task, so resume on the next one.
      setTimeout(() => {
        if (watching) return
        if (visible) void video.play().catch(() => undefined)
        else {
          video.pause()
          view.setFilm(null)
        }
      })
    },
  }

  return {
    object: group,
    update({ t, time }) {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && videoMat.map !== videoMap) {
        videoMat.map = videoMap
        videoMat.needsUpdate = true
      }
      const p = clamp01(intro(t, c.delay, 1.1))
      group.scale.setScalar(Math.max(0.001, easeOutBack(p)))
      group.position.z = (c.lift ?? 0.06) + 0.006 * Math.sin(time * 1.3) * p
      group.rotation.z = Math.sin(time * 0.7) * 0.006 * p
    },
    onShow() {
      visible = true
      view.setFilm(film)
      if (watching) return
      if (video.ended) video.currentTime = 0
      play()
    },
    onHide() {
      visible = false
      if (watching) return // the full-screen player has it
      video.pause()
      view.setFilm(null)
    },
    onTap: () => film.toggleSound(),
    dispose() {
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
      videoMap.dispose()
      frameMap.dispose()
      mask.dispose()
      disposeObject(group)
    },
  }
}
