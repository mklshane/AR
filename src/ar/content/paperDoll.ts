import * as THREE from 'three'
import * as sfx from '../sfx'
import type { PaperDollContent, PaperDollPiece } from '../types'
import { type BuildContext, type ContentNode, Pulse, clamp01, disposeObject } from './ContentNode'

/**
 * p39 "The Thrift-Up Doll": a paper doll whose clothes can be dragged onto her. The page is covered by
 * the same art without the clothes, and each piece becomes a cut-out that starts on its printed spot.
 *
 * - Drop a piece on the doll (or just tap it) and it snaps on with a click.
 * - One outfit at a time: putting on another sends the current one gliding back to its spot.
 * - Drag a worn piece off (or tap it) to take it off. Shoes are their own slot, so outfits don't swap them.
 */

/** Lift above the page for each state, in anchor units (page width = 1). */
const Z = { home: 0.002, shoes: 0.004, outfit: 0.006, held: 0.05 }
/** How quickly pieces glide to where they're going (1/s; higher is snappier). */
const FOLLOW = 22
const SETTLE = 9
/** A press that moves less than this (anchor units) is a tap, not a drag. */
const TAP_SLOP = 0.012

type State = 'home' | 'held' | 'worn'

/** Blur radius of a piece's shadow, as a fraction of its width; the shadow texture is padded by this. */
const BLUR = 0.05

/** The piece's silhouette, black and softly blurred (canvas shadowBlur, which every phone supports). */
function shadowTexture(img: HTMLImageElement) {
  const pad = Math.round(img.width * BLUR)
  const canvas = document.createElement('canvas')
  canvas.width = img.width + pad * 2
  canvas.height = img.height + pad * 2
  const ctx = canvas.getContext('2d')!
  // Draw the image off-canvas and let only its shadow fall inside.
  ctx.shadowColor = '#000'
  ctx.shadowBlur = pad * 0.8
  ctx.shadowOffsetX = canvas.width
  ctx.drawImage(img, pad - canvas.width, pad)
  return new THREE.CanvasTexture(canvas)
}

interface Piece {
  cfg: PaperDollPiece
  mesh: THREE.Mesh
  shadow: THREE.Mesh
  home: THREE.Vector3
  worn: THREE.Vector3
  state: State
  /** Where it's heading and at what scale; the mesh eases towards these. */
  to: THREE.Vector3
  toScale: number
  pos: THREE.Vector3
  scale: number
  snap: Pulse
}

const MAGENTA = '#a3248f' // the page's title
const INK = '#3a2233'

/** A white paper tag with a strip of pink washi tape, like something stuck on the page. */
async function noteTexture(title: string, hint: string) {
  await Promise.all(['700 64px Montserrat', '500 31px Montserrat'].map((f) => document.fonts?.load(f).catch(() => undefined)))
  const W = 800
  const H = 236
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.shadowColor = 'rgba(70, 20, 60, 0.3)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 8
  ctx.fillStyle = '#fffaf6'
  ctx.beginPath()
  ctx.roundRect(24, 40, W - 48, H - 70, 14)
  ctx.fill()
  ctx.restore()
  // Washi tape across the top, slightly askew, with faint stripes.
  ctx.save()
  ctx.translate(W / 2, 44)
  ctx.rotate(-0.04)
  ctx.fillStyle = 'rgba(236, 140, 200, 0.75)'
  ctx.fillRect(-90, -22, 180, 44)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  for (let x = -84; x < 90; x += 22) ctx.fillRect(x, -22, 8, 44)
  ctx.restore()
  ctx.textAlign = 'center'
  ctx.fillStyle = MAGENTA
  ctx.font = '700 64px Montserrat, system-ui, sans-serif'
  ctx.fillText(title, W / 2, 132)
  ctx.fillStyle = INK
  ctx.font = '500 31px Montserrat, system-ui, sans-serif'
  ctx.fillText(hint, W / 2, 182)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  return { map, aspect: H / W }
}

export async function buildPaperDoll(c: PaperDollContent, { page, assets }: BuildContext): Promise<ContentNode> {
  const group = new THREE.Group()
  group.position.z = c.lift ?? 0

  // The page without its clothes, so a piece's printed spot is empty once it's picked up.
  const coverMap = await assets.texture(c.cover)
  const coverMat = new THREE.MeshBasicMaterial({ map: coverMap, transparent: true, opacity: 0, toneMapped: false })
  const cover = new THREE.Mesh(new THREE.PlaneGeometry(1, page.height / page.width), coverMat)
  cover.position.z = 0.0005
  group.add(cover)

  // The note floats just above the page's top edge (so it covers nothing), tilted a touch, bobbing gently.
  let note: THREE.Mesh | null = null
  if (c.note) {
    const { map, aspect } = await noteTexture(c.note.title, c.note.hint)
    const w = page.len(700)
    note = new THREE.Mesh(new THREE.PlaneGeometry(w, w * aspect), new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))
    note.position.set(...page.point([540, -95]), 0.02)
    note.rotation.z = 0.035
    group.add(note)
  }

  const at = (px: [number, number], z: number) => new THREE.Vector3(...page.point(px), z)
  const [bx, by, bw, bh] = c.body
  const [bx0, by0] = page.point([bx, by + bh])
  const [bx1, by1] = page.point([bx + bw, by])
  const onBody = (p: THREE.Vector3) => p.x >= bx0 && p.x <= bx1 && p.y >= by0 && p.y <= by1

  const pieces: Piece[] = await Promise.all(
    c.pieces.map(async (cfg, i) => {
      const map = await assets.texture(cfg.src)
      const img = map.image as HTMLImageElement
      const w = page.len(cfg.width)
      const geo = new THREE.PlaneGeometry(w, (w * img.height) / img.width)
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false }))
      mesh.renderOrder = 10 + i
      // A soft paper shadow, offset down-right; it spreads and fades out as the piece lifts.
      const shadowMap = shadowTexture(img)
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(w * (1 + 2 * BLUR), ((w * img.height) / img.width) * (1 + (2 * BLUR * img.width) / img.height)),
        new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false }),
      )
      shadow.renderOrder = mesh.renderOrder - 0.5
      group.add(shadow, mesh)
      const home = at(cfg.home, Z.home)
      return {
        cfg,
        mesh,
        shadow,
        home,
        worn: at(cfg.worn, cfg.slot === 'shoes' ? Z.shoes : Z.outfit),
        state: 'home' as State,
        to: home.clone(),
        toScale: 1,
        pos: home.clone(),
        scale: 1,
        snap: new Pulse(0.35),
      }
    }),
  )
  const byMesh = new Map(pieces.map((p) => [p.mesh as THREE.Object3D, p]))
  const wornIn = (slot: PaperDollPiece['slot']) => pieces.find((p) => p.state === 'worn' && p.cfg.slot === slot)

  let now = 0
  let held: { piece: Piece; grab: THREE.Vector3; start: THREE.Vector3; moved: boolean; was: State } | null = null

  function sendHome(p: Piece) {
    p.state = 'home'
    p.to.copy(p.home)
    p.toScale = 1
  }

  function wear(p: Piece) {
    const current = wornIn(p.cfg.slot)
    if (current && current !== p) {
      sendHome(current) // smoothly back to its printed spot
      sfx.swish()
    }
    p.state = 'worn'
    p.to.copy(p.worn)
    p.toScale = p.cfg.wornScale
    p.snap.trigger(now)
    sfx.snap()
  }

  return {
    object: group,
    update({ t, dt, time }) {
      now = time
      coverMat.opacity = clamp01(t / 0.35)
      if (note) {
        const pop = clamp01((t - 0.5) / 0.5)
        ;(note.material as THREE.MeshBasicMaterial).opacity = pop
        note.scale.setScalar(0.85 + 0.15 * (1 - (1 - pop) ** 3))
        note.position.z = 0.02 + 0.004 * Math.sin(time * 1.6)
        note.rotation.z = 0.035 + 0.012 * Math.sin(time * 1.1)
      }
      for (const p of pieces) {
        const k = 1 - Math.exp(-(p.state === 'held' ? FOLLOW : SETTLE) * dt)
        p.pos.lerp(p.to, k)
        p.scale += (p.toScale - p.scale) * k
        // Snap: a quick squash-and-settle, like card stock clicking into place.
        const s = p.snap.value(time)
        const bounce = s > 0 ? 1 + 0.07 * Math.sin(Math.PI * s) * (1 - s) : 1
        p.mesh.position.copy(p.pos)
        p.mesh.scale.setScalar(p.scale * bounce)
        const lift = clamp01((p.pos.z - Z.home) / (Z.held - Z.home))
        p.shadow.position.set(p.pos.x + 0.003 + lift * 0.01, p.pos.y - 0.004 - lift * 0.014, Z.home - 0.001 + lift * 0.001)
        p.shadow.scale.setScalar(p.scale * (1 + lift * 0.05))
        ;(p.shadow.material as THREE.MeshBasicMaterial).opacity = 0.32 - lift * 0.1
      }
    },
    onDragStart(hit, point) {
      const piece = byMesh.get(hit.object)
      if (!piece) return false // the cover: let the view pan/zoom instead
      if (held) return false
      held = { piece, grab: piece.pos.clone().sub(point).setZ(0), start: point.clone(), moved: false, was: piece.state }
      if (piece.state === 'worn') sfx.swish()
      else sfx.pickUp()
      piece.state = 'held'
      piece.to.set(point.x + held.grab.x, point.y + held.grab.y, Z.held)
      // Bring it to the front while it's carried.
      piece.mesh.renderOrder = 100
      piece.shadow.renderOrder = 99.5
      return true
    },
    onDragMove(point) {
      if (!held) return
      const { piece, grab } = held
      if (point.distanceTo(held.start) > TAP_SLOP) held.moved = true
      piece.to.set(point.x + grab.x, point.y + grab.y, Z.held)
      // Preview the fit: it grows or shrinks to its worn size over the doll.
      piece.toScale = onBody(point) ? piece.cfg.wornScale : 1
    },
    onDragEnd(point) {
      if (!held) return
      const { piece, moved, was } = held
      held = null
      piece.mesh.renderOrder = 10 + pieces.indexOf(piece)
      piece.shadow.renderOrder = piece.mesh.renderOrder - 0.5
      if (!moved) {
        // A tap: put it on, or take it off.
        if (was === 'worn') sendHome(piece)
        else wear(piece)
      } else if (point && onBody(point)) wear(piece)
      else sendHome(piece)
    },
    onHide() {
      // Lost the page mid-drag: put the piece back where it came from.
      if (!held) return
      const { piece, was } = held
      held = null
      if (was === 'worn') {
        piece.state = 'worn'
        piece.to.copy(piece.worn)
        piece.toScale = piece.cfg.wornScale
      } else sendHome(piece)
    },
    dispose() {
      disposeObject(group)
    },
  }
}
