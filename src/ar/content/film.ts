import * as THREE from 'three'
import type { AssetManager } from '../AssetManager'
import { takeVideo } from '../mediaUnlock'
import type { FilmContent } from '../types'
import { type BuildContext, type ContentNode, type FilmHandle, clamp01, disposeObject, easeOutBack, intro } from './ContentNode'

/**
 * A page's documentary, framed to match that page's design. It pops up on the page, then lifts off it
 * to fill the screen's width (see SCREEN), so it's watchable however small the print is in the camera.
 * Starts with sound when the browser allows (see mediaUnlock), and can go full-screen and back without
 * losing its place (see FilmHandle).
 */

type Rect = { x: number; y: number; w: number; h: number }

interface FrameStyle {
  /** Frame canvas size in px; the plane is `c.width` page px wide. */
  size: [number, number]
  /** Where the film shows through, in canvas px (16:9). */
  win: Rect
  /** Everything that's drawn (film, border, corners, caption), in canvas px; this is what fits the screen. */
  box: Rect
  /** A per-film box, when its options change what's drawn (null: use `box`). */
  boxFor?(c: FilmContent): Rect | null
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
  box: { x: 52, y: 22, w: 1096, h: 738 },
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

// The film is 1320×720 (the source's own black matte cropped off) with softly rounded corners.
const FL_WIN: Rect = { x: 70, y: 70, w: 1060, h: 578 }
const FL_RADIUS = 38
// The two corners as a matched pair: same size, each overhanging its corner of the film by FL_OVER,
// so their outer strokes straddle the film's edge rather than covering the picture.
const FL_CORNER_W = 250
const FL_OVER = 16
const FL_TAB = { x: FL_WIN.x + 46, y: FL_WIN.y + FL_WIN.h - 10, w: 500, h: 150 }
const SAGE = '#9db48a' // the page's background

const flourish: FrameStyle = {
  size: [1200, 860],
  win: FL_WIN,
  box: {
    x: FL_WIN.x - FL_OVER,
    y: FL_WIN.y - FL_OVER,
    w: FL_WIN.w + 2 * FL_OVER,
    h: FL_TAB.y + FL_TAB.h - (FL_WIN.y - FL_OVER),
  },
  async draw(ctx, c, duration, assets) {
    const win = FL_WIN
    const [tl, br] = await Promise.all([assets.image('/ar/p24/flourish-tl.webp'), assets.image('/ar/p24/flourish-br.webp')])
    await loadFonts('96px "Miss Fajardose"', '600 20px Montserrat')

    // Caption tab in the page's sage, tucked under the bottom-left (so it reads over the portrait too).
    const tab = FL_TAB
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

    // The page's white corners, outer edges just past the film's corners.
    const fw = FL_CORNER_W
    const tlh = (fw * tl.height) / tl.width
    const brh = (fw * br.height) / br.width
    ctx.drawImage(tl, win.x - FL_OVER, win.y - FL_OVER, fw, tlh)
    ctx.drawImage(br, win.x + win.w + FL_OVER - fw, win.y + win.h + FL_OVER - brh, fw, brh)
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

// ---- p30 "script": a plain rounded film with a white keyline, the page's white script name on a terracotta tab ----

const SC_WIN: Rect = { x: 70, y: 70, w: 1060, h: 596 }
const SC_RADIUS = 30
const SC_KEY = 5 // white keyline, like the script's stroke
const SC_TAB = { x: SC_WIN.x + 40, y: SC_WIN.y + SC_WIN.h - 8, h: 182 } // width follows the caption
const TERRACOTTA = '#a8765a' // the page's warm wall, a shade deeper so white reads on it
/** With a decor: the mat around the film (px), and the area that then fits the screen. */
const SC_MAT = 30
const SC_DECOR_BOX: Rect = { x: 16, y: 16, w: 1168, h: SC_TAB.y + SC_TAB.h - 16 }

/** Points along a cubic Bézier. */
function bezier(p: number[][], n: number) {
  const out: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
    out.push([k.reduce((s, w, j) => s + w * p[j][0], 0), k.reduce((s, w, j) => s + w * p[j][1], 0)])
  }
  return out
}

/** A calligraphic stroke along a Bézier: thin at both ends, `w` px at its widest. */
function ribbon(ctx: CanvasRenderingContext2D, p: number[][], w: number) {
  const pts = bezier(p, 80)
  const left: [number, number][] = []
  const right: [number, number][] = []
  pts.forEach(([x, y], i) => {
    const [ax, ay] = pts[Math.max(0, i - 1)]
    const [bx, by] = pts[Math.min(pts.length - 1, i + 1)]
    const len = Math.hypot(bx - ax, by - ay) || 1
    const [nx, ny] = [-(by - ay) / len, (bx - ax) / len]
    const t = i / (pts.length - 1)
    const half = (w / 2) * Math.pow(Math.sin(Math.PI * t), 0.7) + 0.6
    left.push([x + nx * half, y + ny * half])
    right.push([x - nx * half, y - ny * half])
  })
  ctx.beginPath()
  left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  right.reverse().forEach(([x, y]) => ctx.lineTo(x, y))
  ctx.closePath()
  ctx.fill()
}

/** A leafy sprig from (x, y) heading `angle` (radians), `len` px long, leaves alternating up the stem. */
function sprig(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, len: number, bend: number, colors: string[]) {
  const dir = [Math.cos(angle), Math.sin(angle)]
  const nrm = [-dir[1], dir[0]]
  const end = [x + dir[0] * len, y + dir[1] * len]
  const mid = [x + dir[0] * len * 0.5 + nrm[0] * bend, y + dir[1] * len * 0.5 + nrm[1] * bend]
  const stem = bezier([[x, y], mid, mid, end], 40)
  ctx.strokeStyle = colors[0]
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  stem.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy)))
  ctx.stroke()
  const n = 7
  for (let i = 1; i <= n; i++) {
    const k = i / (n + 0.6)
    const [px, py] = stem[Math.round(k * 40)]
    const [qx, qy] = stem[Math.min(40, Math.round(k * 40) + 1)]
    const along = Math.atan2(qy - py, qx - px)
    const side = i % 2 ? 1 : -1
    const size = 72 * (1 - k * 0.5)
    leaf(ctx, px, py, along + side * 0.75, size, colors[i % 2 ? 1 : 2])
  }
  leaf(ctx, end[0], end[1], angle, 62, colors[1])
}

/** One pointed leaf with a pale midrib. */
function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, size: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(a)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(size * 0.5, -size * 0.38, size, 0)
  ctx.quadraticCurveTo(size * 0.5, size * 0.38, 0, 0)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 240, 0.35)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(size * 0.08, 0)
  ctx.lineTo(size * 0.85, 0)
  ctx.stroke()
  ctx.restore()
}

/** The mat behind a decorated film: rounded, softly shadowed, with the page's texture. */
function mat(ctx: CanvasRenderingContext2D, win: Rect, decor: 'swash' | 'leaves') {
  const r = { x: win.x - SC_MAT, y: win.y - SC_MAT, w: win.w + 2 * SC_MAT, h: win.h + 2 * SC_MAT }
  const shape = () => {
    ctx.beginPath()
    ctx.roundRect(r.x, r.y, r.w, r.h, SC_RADIUS + SC_MAT)
  }
  ctx.save()
  ctx.shadowColor = 'rgba(40, 30, 20, 0.35)'
  ctx.shadowBlur = 36
  ctx.shadowOffsetY = 16
  ctx.fillStyle = decor === 'swash' ? '#cf9a76' : '#c3cfb8'
  shape()
  ctx.fill()
  ctx.restore()
  ctx.save()
  shape()
  ctx.clip()
  if (decor === 'swash') {
    // The facing page's sepia halftone: dots that swell and shrink in soft waves.
    ctx.fillStyle = 'rgba(110, 62, 36, 0.32)'
    for (let y = r.y; y < r.y + r.h; y += 7) {
      for (let x = r.x + ((y / 7) % 2) * 3.5; x < r.x + r.w; x += 7) {
        const d = 1.1 + 0.9 * Math.sin(x * 0.013 + Math.sin(y * 0.02) * 2) * Math.cos(y * 0.011)
        if (d <= 0.3) continue
        ctx.beginPath()
        ctx.arc(x, y, d, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else {
    // Handmade-paper grain, like the page.
    for (let i = 0; i < 2600; i++) {
      const x = r.x + ((i * 7919) % 1000) / 1000 * r.w
      const y = r.y + ((i * 104729) % 1000) / 1000 * r.h
      ctx.fillStyle = i % 3 ? 'rgba(70, 95, 60, 0.12)' : 'rgba(255, 255, 255, 0.25)'
      ctx.fillRect(x, y, 1.5 + (i % 4), 1.5)
    }
  }
  ctx.restore()
}

/** The page's ornament over two corners (top-left and bottom-right; the caption tab has the bottom-left). */
function ornament(ctx: CanvasRenderingContext2D, win: Rect, decor: 'swash' | 'leaves') {
  const [l, t, r, b] = [win.x, win.y, win.x + win.w, win.y + win.h]
  if (decor === 'swash') {
    // White script swashes, like the big "Yano" stroke sweeping across the page.
    ctx.fillStyle = '#ffffff'
    ctx.save()
    ctx.shadowColor = 'rgba(80, 40, 20, 0.35)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 2
    ribbon(ctx, [[l + 380, t - 44], [l + 60, t - 74], [l - 64, t - 6], [l - 30, t + 200]], 24)
    ribbon(ctx, [[l - 30, t + 200], [l - 8, t + 270], [l + 50, t + 140], [l - 4, t + 66]], 13)
    ribbon(ctx, [[r - 420, b + 48], [r - 60, b + 78], [r + 66, b + 6], [r + 32, b - 220]], 24)
    ribbon(ctx, [[r + 32, b - 220], [r + 10, b - 290], [r - 48, b - 160], [r + 4, b - 76]], 13)
    ctx.restore()
  } else {
    // Leafy sprigs, the retreat's jungle growing in over the corners.
    const greens = ['#3f5a34', '#5d784f', '#87a56b']
    const deep = ['#33492b', '#4b663f', '#6f8f58']
    ctx.save()
    ctx.shadowColor = 'rgba(20, 40, 15, 0.35)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 3
sprig(ctx, l - 44, t - 34, 0.1, 400, -36, greens)
    sprig(ctx, l - 44, t - 34, 1.45, 300, 32, deep)
    sprig(ctx, l - 44, t - 34, 0.78, 230, 12, greens)
    sprig(ctx, r + 44, b + 34, Math.PI + 0.1, 400, -36, deep)
    sprig(ctx, r + 44, b + 34, Math.PI + 1.45, 300, 32, greens)
    sprig(ctx, r + 44, b + 34, Math.PI + 0.78, 230, 12, deep)
    ctx.restore()
  }
}

const script: FrameStyle = {
  size: [1200, 860],
  win: SC_WIN,
  box: {
    x: SC_WIN.x - SC_KEY,
    y: SC_WIN.y - SC_KEY,
    w: SC_WIN.w + 2 * SC_KEY,
    h: SC_TAB.y + SC_TAB.h - (SC_WIN.y - SC_KEY),
  },
  boxFor: (c) => (c.decor ? SC_DECOR_BOX : null),
  async draw(ctx, c, duration) {
    const win = SC_WIN
    await loadFonts('110px "Miss Fajardose"', '600 20px Montserrat')
    const line = [c.subtitle, 'Docufilm', runtime(duration)].filter(Boolean).join(' · ').toUpperCase()
    ctx.font = '600 20px Montserrat, system-ui, sans-serif'
    ctx.letterSpacing = '4px'
    const tab = { ...SC_TAB, w: Math.min(win.w - 80, ctx.measureText(line).width + 64) }
    ctx.letterSpacing = '0px'

    ctx.save()
    ctx.shadowColor = 'rgba(60, 36, 22, 0.35)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 10
    ctx.fillStyle = c.accent ?? TERRACOTTA
    ctx.beginPath()
    ctx.roundRect(tab.x, tab.y, tab.w, tab.h, [0, 0, 22, 22])
    ctx.fill()
    ctx.restore()
    if (c.decor) mat(ctx, win, c.decor)
    ctx.save()
    // White keyline with a soft shadow; the window is punched out below.
    ctx.shadowColor = 'rgba(60, 36, 22, 0.4)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 18
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(win.x - SC_KEY, win.y - SC_KEY, win.w + 2 * SC_KEY, win.h + 2 * SC_KEY, SC_RADIUS + SC_KEY)
    ctx.fill()
    ctx.restore()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.roundRect(win.x, win.y, win.w, win.h, SC_RADIUS)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
    if (c.decor) ornament(ctx, win, c.decor)

    // The caption tab over the mat, so its text sits on the tab's colour.
    if (c.decor) {
      ctx.fillStyle = c.accent ?? TERRACOTTA
      ctx.beginPath()
      ctx.roundRect(tab.x, win.y + win.h + SC_KEY, tab.w, tab.y + tab.h - (win.y + win.h + SC_KEY), [0, 0, 22, 22])
      ctx.fill()
    }
    ctx.fillStyle = '#ffffff'
    ctx.font = '110px "Miss Fajardose", cursive'
    ctx.fillText(c.title, tab.x + 30, tab.y + 84)
    ctx.font = '600 20px Montserrat, system-ui, sans-serif'
    ctx.letterSpacing = '4px'
    ctx.fillText(line, tab.x + 32, tab.y + 156)
    ctx.letterSpacing = '0px'
  },
  mask() {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round((512 * SC_WIN.h) / SC_WIN.w)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.roundRect(0, 0, canvas.width, canvas.height, SC_RADIUS * (canvas.width / SC_WIN.w))
    ctx.fill()
    return canvas
  },
}

const STYLES: Record<FilmContent['frame'], FrameStyle> = { hex, flourish, script }

/** Where the film settles on screen: its frame spans the width less PAD each side, centred at Y. */
const SCREEN = {
  /** Side padding, as a fraction of the screen width (~20 px on a phone held upright). */
  pad: 0.05,
  /** Never taller than this fraction of the screen (phone held sideways). */
  maxHeight: 0.8,
  /** Vertical centre in NDC (−1 bottom … 1 top): a little high, clear of the shutter row. */
  y: 0.12,
  /** Seconds on the page before lifting off, and how long the lift takes. */
  liftAt: 0.7,
  liftFor: 0.9,
}

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

/** World point at camera-space depth `depth` along the ray through (ndcX, ndcY), zoom included. */
function screenPoint(camera: THREE.PerspectiveCamera, ndcX: number, ndcY: number, depth: number, out: THREE.Vector3) {
  out.set(ndcX, ndcY, 0.5).unproject(camera).applyMatrix4(camera.matrixWorldInverse)
  out.multiplyScalar(depth / -out.z)
  return out.applyMatrix4(camera.matrixWorld)
}

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
  const lift = c.lift ?? 0.06
  group.position.set(x, y, lift)

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

  // Scratch for the per-frame page → screen blend.
  const { camera } = view
  const box = style.boxFor?.(c) ?? style.box
  const boxCentre = new THREE.Vector3(cx(box.x + box.w / 2), cy(box.y + box.h / 2), 0)
  const onPage = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3() }
  const onScreen = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3() }
  const m = new THREE.Matrix4()
  const anchorPos = new THREE.Vector3()
  const left = new THREE.Vector3()
  const right = new THREE.Vector3()
  const top = new THREE.Vector3()
  const bottom = new THREE.Vector3()

  /** Pose the group `k` of the way (0 page … 1 screen), with `pop` as its intro scale on the page. */
  function place(k: number, pop: number, time: number) {
    const parent = group.parent
    if (!parent) return
    parent.updateWorldMatrix(true, false)
    const bob = 0.006 * Math.sin(time * 1.3)
    const sway = Math.sin(time * 0.7) * 0.006
    m.compose(
      new THREE.Vector3(x, y, lift + bob * pop),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), sway * pop),
      new THREE.Vector3(pop, pop, pop),
    )
    m.premultiply(parent.matrixWorld).decompose(onPage.pos, onPage.quat, onPage.scale)
    if (k <= 0) {
      group.position.set(x, y, lift + bob * pop)
      group.rotation.set(0, 0, sway * pop)
      group.scale.setScalar(pop)
      return
    }

    // Screen spot: facing the camera, a little nearer than the page so it stays in front of it.
    camera.updateMatrixWorld()
    anchorPos.setFromMatrixPosition(parent.matrixWorld).applyMatrix4(camera.matrixWorldInverse)
    const depth = Math.max(camera.near * 2, -anchorPos.z * 0.8)
    const screenW = screenPoint(camera, -1, SCREEN.y, depth, left).distanceTo(screenPoint(camera, 1, SCREEN.y, depth, right))
    const screenH = screenPoint(camera, 0, 1, depth, top).distanceTo(screenPoint(camera, 0, -1, depth, bottom))
    const s = Math.min((screenW * (1 - 2 * SCREEN.pad)) / (box.w * px), (screenH * SCREEN.maxHeight) / (box.h * px))
    camera.getWorldQuaternion(onScreen.quat)
    onScreen.quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), sway * 0.4))
    onScreen.scale.setScalar(s)
    screenPoint(camera, 0, SCREEN.y, depth, onScreen.pos).sub(boxCentre.clone().multiplyScalar(s).applyQuaternion(onScreen.quat))

    // Blend in world space, then express it in the anchor's space.
    m.compose(
      onPage.pos.lerp(onScreen.pos, k),
      onPage.quat.slerp(onScreen.quat, k),
      onPage.scale.lerp(onScreen.scale, k),
    )
    m.premultiply(new THREE.Matrix4().copy(parent.matrixWorld).invert()).decompose(group.position, group.quaternion, group.scale)
  }

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
      const pop = Math.max(0.001, easeOutBack(clamp01(intro(t, c.delay, 1.1))))
      const k = easeInOutCubic(intro(t, (c.delay ?? 0) + SCREEN.liftAt, SCREEN.liftFor))
      place(k, pop, time)
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
