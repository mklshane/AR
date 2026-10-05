import * as THREE from 'three'
import type { AssetManager } from '../AssetManager'
import { takeVideo } from '../mediaUnlock'
import type { FilmContent } from '../types'
import { type BuildContext, type ContentNode, type FilmHandle, clamp01, disposeObject, easeOutBack, intro } from './ContentNode'

/**
 * A page's documentary, framed to match that page's design. Starts with sound when the browser allows
 * (see mediaUnlock), and can go full-screen and back without losing its place (see FilmHandle).
 */

type Rect = { x: number; y: number; w: number; h: number }

interface FrameStyle {
  /** Frame canvas size in px; the plane is `c.width` page px wide. */
  size: [number, number]
  /** Where the film shows through, in canvas px (16:9). */
  win: Rect
  /** Paint everything around the window; the window itself must end up transparent. */
  draw(ctx: CanvasRenderingContext2D, c: FilmContent, duration: number, assets: AssetManager): Promise<void>
  /** Optional window shape (white = film) when it isn't a plain rectangle. */
  mask?(): HTMLCanvasElement
}

const runtime = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

async function loadFonts(...fonts: string[]) {
  await Promise.all(fonts.map((f) => document.fonts?.load(f).catch(() => undefined)))
}

// ---- p15 "hex": a pointy-ended hexagon like the spread's photo crops, white paper edge, honey keyline ----

const HEX_WIN: Rect = { x: 70, y: 40, w: 1060, h: 596 }
const SLANT = HEX_WIN.h / 2 / Math.tan(Math.PI / 3) // 60° sides, as on the page

function hexPath(ctx: CanvasRenderingContext2D, { x, y, w, h }: Rect, grow = 0) {
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

const hex: FrameStyle = {
  size: [1200, 860],
  win: HEX_WIN,
  async draw(ctx, c, duration) {
    const INK = '#2e2418'
    const HONEY = '#e2a72e'
    const PAPER = '#ffffff'
    const BORDER = 18
    const win = HEX_WIN
    await loadFonts('600 30px Montserrat', '500 30px Montserrat')

    // White paper border with a soft shadow, as if this photo panel had lifted off the page.
    ctx.save()
    ctx.shadowColor = 'rgba(46, 36, 24, 0.35)'
    ctx.shadowBlur = 36
    ctx.shadowOffsetY = 18
    hexPath(ctx, win, BORDER)
    ctx.fillStyle = PAPER
    ctx.fill()
    ctx.restore()

    // Caption tab, tucked under the bottom-left of the panel, with one slanted end like the hexagons.
    const tab = { x: win.x + SLANT * 0.55, y: win.y + win.h + BORDER - 6, w: 470, h: 112 }
    ctx.save()
    ctx.shadowColor = 'rgba(46, 36, 24, 0.25)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 10
    ctx.beginPath()
    ctx.moveTo(tab.x, tab.y)
    ctx.lineTo(tab.x + tab.w, tab.y)
    ctx.lineTo(tab.x + tab.w - 34, tab.y + tab.h)
    ctx.lineTo(tab.x, tab.y + tab.h)
    ctx.closePath()
    ctx.fillStyle = PAPER
    ctx.fill()
    ctx.restore()
    hexPath(ctx, win, BORDER) // re-cover the tab's shadow where it overlaps the panel
    ctx.fillStyle = PAPER
    ctx.fill()

    // Punch out the film window and edge it with a honey keyline.
    ctx.globalCompositeOperation = 'destination-out'
    hexPath(ctx, win)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
    hexPath(ctx, win, 3)
    ctx.lineWidth = 6
    ctx.strokeStyle = HONEY
    ctx.stroke()

    ctx.fillStyle = HONEY
    ctx.font = '600 25px Montserrat, system-ui, sans-serif'
    ctx.letterSpacing = '3px'
    ctx.fillText(c.title.toUpperCase(), tab.x + 30, tab.y + 50)
    ctx.letterSpacing = '0px'
    ctx.fillStyle = INK
    ctx.font = '500 30px Montserrat, system-ui, sans-serif'
    ctx.fillText(`Docufilm · ${runtime(duration)}`, tab.x + 30, tab.y + 90)
  },
  mask() {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round((512 * HEX_WIN.h) / HEX_WIN.w)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(canvas.width / HEX_WIN.w, canvas.height / HEX_WIN.h)
    hexPath(ctx, { x: 0, y: 0, w: HEX_WIN.w, h: HEX_WIN.h }, 4) // a touch larger, tucked under the keyline
    ctx.fillStyle = '#fff'
    ctx.fill()
    return canvas
  },
}

// ---- p24 "flourish": the page's own white baroque corners around the film, script caption below ----

// The film is 880×480 (the source's own black matte cropped off) with softly rounded corners.
const FL_WIN: Rect = { x: 70, y: 70, w: 1060, h: 578 }
const FL_RADIUS = 38
const SAGE = '#9db48a' // the page's background

const flourish: FrameStyle = {
  size: [1200, 860],
  win: FL_WIN,
  async draw(ctx, c, duration, assets) {
    const win = FL_WIN
    const [tl, br] = await Promise.all([assets.image('/ar/p24/flourish-tl.webp'), assets.image('/ar/p24/flourish-br.webp')])
    await loadFonts('96px "Miss Fajardose"', '600 20px Montserrat')

    // Caption tab in the page's sage, tucked under the bottom-left (so it reads over the portrait too).
    const tab = { x: win.x + 46, y: win.y + win.h - 10, w: 500, h: 150 }
    ctx.save()
    ctx.shadowColor = 'rgba(24, 44, 20, 0.35)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 10
    ctx.fillStyle = SAGE
    ctx.beginPath()
    ctx.roundRect(tab.x, tab.y, tab.w, tab.h, [0, 0, 22, 22])
    ctx.fill()
    // Soft shadow around the film (punched out below, so only the halo remains).
    ctx.shadowColor = 'rgba(24, 44, 20, 0.4)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 18
    ctx.beginPath()
    ctx.roundRect(win.x, win.y, win.w, win.h, FL_RADIUS)
    ctx.fill()
    ctx.restore()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.roundRect(win.x, win.y, win.w, win.h, FL_RADIUS)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    ctx.fillStyle = '#ffffff'
    ctx.font = '96px "Miss Fajardose", cursive'
    ctx.fillText(c.title, tab.x + 30, tab.y + 92)
    ctx.font = '600 20px Montserrat, system-ui, sans-serif'
    ctx.letterSpacing = '4px'
    const line = [c.subtitle, 'Docufilm', runtime(duration)].filter(Boolean).join(' · ')
    ctx.fillText(line.toUpperCase(), tab.x + 32, tab.y + 128)
    ctx.letterSpacing = '0px'

    // The page's white corners at their printed size (44% of the portrait's width), overhanging a little,
    // so the top-left one lands on the printed one when the film sits on the portrait's corner.
    const fw = win.w * 0.435
    const tlh = (fw * tl.height) / tl.width
    const brh = (fw * br.height) / br.width
    ctx.drawImage(tl, win.x - fw * 0.107, win.y - tlh * 0.097, fw, tlh)
    ctx.drawImage(br, win.x + win.w - fw * 0.89, win.y + win.h - brh * 0.92, fw, brh)
  },
  mask() {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round((512 * FL_WIN.h) / FL_WIN.w)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const k = canvas.width / FL_WIN.w
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.roundRect(0, 0, canvas.width, canvas.height, FL_RADIUS * k)
    ctx.fill()
    return canvas
  },
}

const STYLES: Record<FilmContent['frame'], FrameStyle> = { hex, flourish }

export async function buildFilm(c: FilmContent, { page, assets, view }: BuildContext): Promise<ContentNode> {
  const style = STYLES[c.frame]
  const [CW, CH] = style.size
  const WIN = style.win

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
  const posterMap = await assets.texture(c.poster)
  const maskCanvas = style.mask?.()
  const mask = maskCanvas ? new THREE.CanvasTexture(maskCanvas) : null
  const videoMat = new THREE.MeshBasicMaterial({ map: posterMap, alphaMap: mask, transparent: !!mask, side: THREE.DoubleSide, toneMapped: false })
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

  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = CH
  await style.draw(canvas.getContext('2d')!, c, video.duration || 0, assets)
  const frameMap = new THREE.CanvasTexture(canvas)
  frameMap.colorSpace = THREE.SRGBColorSpace
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
    title: c.title,
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
      mask?.dispose()
      disposeObject(group)
    },
  }
}
