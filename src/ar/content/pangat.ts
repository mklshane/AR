import * as THREE from 'three'
import * as sfx from '../sfx'
import type { PangatContent } from '../types'
import { type BuildContext, type ContentNode, clamp01, disposeObject, easeOutBack, intro } from './ContentNode'
import { type NoteColors, noteTexture } from './note'

/**
 * p58 "Pangat: Ang Pagbabalik ng Leftovers". A pan of leftover lechon sits on the printed flame, and the
 * printed stove knob at the bottom of the page really turns: twist it (or tap it, a notch at a time) and the
 * flame climbs, the pan sizzles, steams and rattles, and at full heat the lechon jumps out, flips and lands
 * back as lechon paksiw. Turn the knob back down and it's leftovers again, ready for another go.
 *
 * Extras (flames, steam, the food cards) live in the pan's own model space, so they move with it, and face
 * the camera each frame.
 */

/** Full turn of the knob, off to max (it's a stove dial: about three quarters of a turn). */
const MAX_TURN = (3 / 2) * Math.PI
/** Knob notches: a tick sound and a tap's step. */
const DETENT = Math.PI / 6
const TAP_STEP = MAX_TURN / 3
const TAP_SLOP = 0.012
/** Seconds held at full heat before the lechon goes. */
const BOIL = 0.5
/** The jump: up-and-over, then a squashy landing. */
const AIR = 1.1
const LAND = 0.35

const COLORS: NoteColors = { title: '#c23a22', ink: '#3a1d14', tape: 'rgba(242, 196, 60, 0.8)' }

function flameTexture() {
  const W = 128
  const H = 256
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  // A teardrop: round at the bottom, a licking point at the top.
  ctx.beginPath()
  ctx.moveTo(W / 2, 4)
  ctx.bezierCurveTo(W * 0.62, H * 0.35, W * 0.98, H * 0.55, W * 0.9, H * 0.78)
  ctx.bezierCurveTo(W * 0.8, H * 0.98, W * 0.2, H * 0.98, W * 0.1, H * 0.78)
  ctx.bezierCurveTo(W * 0.02, H * 0.55, W * 0.38, H * 0.35, W / 2, 4)
  const g = ctx.createRadialGradient(W / 2, H * 0.78, 4, W / 2, H * 0.6, H * 0.6)
  g.addColorStop(0, 'rgba(255, 250, 200, 1)')
  g.addColorStop(0.25, 'rgba(255, 210, 60, 0.95)')
  g.addColorStop(0.6, 'rgba(255, 110, 20, 0.7)')
  g.addColorStop(1, 'rgba(220, 40, 10, 0)')
  ctx.fillStyle = g
  ctx.filter = 'blur(3px)'
  ctx.fill()
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  return map
}

function puffTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
  g.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)')
  g.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

interface Puff {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  age: number
  life: number
  size: number
}

export async function buildPangat(c: PangatContent, { page, assets, view, targetImage }: BuildContext): Promise<ContentNode> {
  const root = new THREE.Group()
  const camera = view.camera

  // ---- The pan (the GLB), lit like the other products, on the printed flame ----
  const gltf = await assets.gltf(c.asset)
  const model = gltf.scene.clone(true)
  const meshByName = (n: string) => model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n)) as THREE.Mesh | undefined
  // The GLB's own food cards (lechon, paksiw) become our animated ones.
  const cardMaps = ['Empty.004', 'Empty.006'].map((n) => {
    const m = meshByName(n)
    if (!m) throw new Error(`[ar] ${c.asset} has no "${n}"`)
    m.visible = false
    return (m.material as THREE.MeshStandardMaterial).map!
  })
  const env = view.environment()
  model.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    for (const m of [mesh.material].flat() as THREE.MeshStandardMaterial[]) {
      if (!m.isMeshStandardMaterial) continue
      m.envMap = env
      m.envMapIntensity = 0.45
      m.color.multiplyScalar(0.9)
    }
  })
  model.updateMatrixWorld(true)
  const box = new THREE.Box3()
  model.traverseVisible((o) => {
    if ((o as THREE.Mesh).isMesh) box.expandByObject(o)
  })
  // The pan body: its base disc (the bottom), and the metal shell's top (the rim).
  const bottom = new THREE.Box3().setFromObject(meshByName('Cylinder.001_2') ?? model)
  const body = { x: bottom.getCenter(new THREE.Vector3()).x, z: bottom.getCenter(new THREE.Vector3()).z, r: (bottom.max.x - bottom.min.x) / 2, y0: bottom.min.y, y1: box.max.y }

  const stand = THREE.MathUtils.degToRad(c.stand ?? 15)
  model.position.set(-box.getCenter(new THREE.Vector3()).x, -box.min.y, -THREE.MathUtils.lerp(box.getCenter(new THREE.Vector3()).z, box.min.z, Math.cos(stand)))
  const holder = new THREE.Group() // pan space = model space shifted by model.position
  holder.rotation.x = stand
  holder.add(model)
  const pan = new THREE.Group()
  const [px, py] = page.point(c.at)
  pan.position.set(px, py, 0)
  pan.add(holder)
  root.add(pan)
  const norm = page.len(c.width) / (box.max.x - box.min.x)
  const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).add(model.position) // model → pan space
  const centre = (y: number) => P(body.x, y, body.z)

  // ---- Flames licking up around the pan's base ----
  const flameMap = flameTexture()
  const flames = Array.from({ length: 7 }, (_, i) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 2).translate(0, 1, 0), // pivot at the base
      new THREE.MeshBasicMaterial({ map: flameMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false }),
    )
    const k = i / 6 - 0.5
    mesh.position.copy(centre(body.y0 - 0.15)).add(new THREE.Vector3(k * body.r * 2.1, 0, (i % 2 ? 0.25 : -0.25) * body.r))
    holder.add(mesh)
    return { mesh, phase: i * 1.7, w: 0.55 + 0.25 * Math.abs(Math.sin(i * 2.3)) }
  })

  // ---- Steam ----
  const puffMap = puffTexture()
  const puffs: Puff[] = Array.from({ length: 36 }, () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: puffMap, transparent: true, depthWrite: false, opacity: 0, toneMapped: false }))
    mesh.visible = false
    holder.add(mesh)
    return { mesh, vel: new THREE.Vector3(), age: 0, life: 0, size: 1 }
  })
  let emitDebt = 0
  function emit(n: number, burst = false) {
    for (const p of puffs) {
      if (n <= 0) break
      if (p.mesh.visible) continue
      n--
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * body.r * 0.7
      p.mesh.position.copy(centre(body.y1 - 0.1)).add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r * 0.5))
      p.vel.set((Math.random() - 0.5) * (burst ? 1.6 : 0.4), (burst ? 1.6 : 0.9) + Math.random() * 0.5, 0)
      p.age = 0
      p.life = 1.3 + Math.random() * 0.8
      p.size = (burst ? 1.1 : 0.7) + Math.random() * 0.5
      p.mesh.visible = true
    }
  }

  // ---- The food: lechon peeking out of the pan, later paksiw ----
  const cardMat = new THREE.MeshBasicMaterial({ map: cardMaps[0], alphaTest: 0.4, side: THREE.DoubleSide, toneMapped: false })
  const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), cardMat)
  const cardSize = (i: number) => {
    const img = cardMaps[i].image as { width: number; height: number }
    const w = body.r * (i === 0 ? 2.3 : 1.7)
    return new THREE.Vector2(w, (w * img.height) / img.width)
  }
  let cardIndex = 0
  // Lechon peeks out over the rim; the paksiw bowl sits down in the pan.
  const restY = () => body.y1 + cardSize(cardIndex).y * (cardIndex === 0 ? 0.12 : -0.12)
  holder.add(card)

  // ---- The knob: the page's own printed knob, cut out as a disc that really turns ----
  const pageMap = await assets.texture(targetImage)
  const [kx, ky] = c.knob.at
  const kr = c.knob.radius
  const knobGeo = new THREE.CircleGeometry(page.len(kr), 72)
  const uv = knobGeo.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    const x = kx + (uv.getX(i) - 0.5) * 2 * kr
    const y = ky - (uv.getY(i) - 0.5) * 2 * kr
    uv.setXY(i, x / page.width, 1 - y / page.height)
  }
  const knob = new THREE.Mesh(knobGeo, new THREE.MeshBasicMaterial({ map: pageMap, toneMapped: false }))
  knob.position.set(...page.point([kx, ky]), 0.0015)
  root.add(knob)
  // A soft glowing ring around it until it's first touched, saying "this one".
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(page.len(kr) * 1.02, page.len(kr) * 1.1, 72),
    new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
  )
  ring.position.copy(knob.position).setZ(0.001)
  root.add(ring)

  // ---- Notes: a hint below the page, and the payoff caption ----
  const noteMesh = async (title: string, hint: string, widthPx: number) => {
    const { map, aspect } = await noteTexture(title, hint, COLORS)
    const w = page.len(widthPx)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * aspect), new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }))
    root.add(mesh)
    return mesh
  }
  const hint = await noteMesh('Turn up the heat!', 'Twist or tap the knob', 620)
  hint.position.set(...page.point([540, c.hintY ?? 1560]), 0.02)
  const caption = await noteMesh('Ang pagbabalik!', 'Lechon kahapon, paksiw ngayon', 660)
  caption.position.set(...page.point([540, -80]), 0.08) // just above the page, clear of the pan

  // ---- State ----
  let angle = 0
  let target = 0
  let touched = false
  let touchedAt = Infinity
  let fullFor = 0
  let coldFor = 0
  let state: 'lechon' | 'jump' | 'paksiw' = 'lechon'
  let jumpT = 0
  let captionAt = -Infinity
  let wiggleAt = -Infinity
  let now = 0
  let visible = false
  let drag: { last: number; start: THREE.Vector3; moved: boolean } | null = null
  const knobCentre = new THREE.Vector3(...page.point([kx, ky]), 0)
  const angleAt = (p: THREE.Vector3) => Math.atan2(p.y - knobCentre.y, p.x - knobCentre.x)

  const camQ = new THREE.Quaternion()
  const parentQ = new THREE.Quaternion()
  const faceCamera = (o: THREE.Object3D) => {
    o.quaternion.copy(parentQ).invert().multiply(camQ)
  }

  return {
    object: root,
    update({ t, dt, time }) {
      now = time
      const popIn = Math.max(0.001, easeOutBack(intro(t, c.delay, 0.8)))
      pan.scale.setScalar(popIn * norm)

      // Knob: ease towards where the finger put it, ticking at each notch.
      const before = Math.floor(angle / DETENT + 1e-6)
      angle += (target - angle) * (1 - Math.exp(-14 * dt))
      if (Math.abs(target - angle) < 1e-4) angle = target
      if (Math.floor(angle / DETENT + 1e-6) !== before) sfx.tick()
      knob.rotation.z = -angle
      const heat = angle / MAX_TURN
      ;(ring.material as THREE.MeshBasicMaterial).opacity = touched ? 0 : 0.25 + 0.25 * Math.sin(time * 4)
      ;(hint.material as THREE.MeshBasicMaterial).opacity = clamp01((t - 1) / 0.5) * clamp01(1 - (time - touchedAt) / 0.6)
      hint.position.z = 0.02 + 0.004 * Math.sin(time * 1.6)

      camera.updateMatrixWorld()
      camera.getWorldQuaternion(camQ)
      holder.updateWorldMatrix(true, false)
      holder.getWorldQuaternion(parentQ)

      // Rattle once it's properly hot.
      const shake = Math.max(0, heat - 0.45) * (state === 'jump' ? 0 : 1)
      const wiggle = Math.max(0, 1 - (time - wiggleAt) / 0.5)
      holder.position.set(Math.sin(time * 47) * 0.012 * shake, Math.abs(Math.sin(time * 31)) * 0.02 * shake, 0)
      holder.rotation.z = Math.sin(time * 53) * 0.02 * shake + Math.sin(time * 30) * 0.06 * wiggle

      // Flames: grow with the heat and flicker.
      for (const f of flames) {
        const flick = 0.75 + 0.25 * Math.sin(time * 13 + f.phase) + 0.12 * Math.sin(time * 29 + f.phase * 2)
        const h = heat * (0.6 + heat) * flick * body.r * 0.9
        f.mesh.scale.set(f.w * body.r * (0.6 + 0.4 * heat), Math.max(0.001, h), 1)
        ;(f.mesh.material as THREE.MeshBasicMaterial).opacity = clamp01(heat * 3) * 0.9
        f.mesh.visible = heat > 0.01
        faceCamera(f.mesh)
      }

      // Steam: a wisp at low heat, billowing at full.
      emitDebt += dt * (heat > 0.15 ? 2 + heat * heat * 16 : 0)
      if (emitDebt >= 1) {
        emit(Math.floor(emitDebt))
        emitDebt %= 1
      }
      for (const p of puffs) {
        if (!p.mesh.visible) continue
        p.age += dt
        const k = p.age / p.life
        if (k >= 1) {
          p.mesh.visible = false
          continue
        }
        p.mesh.position.addScaledVector(p.vel, dt)
        p.vel.x += Math.sin(time * 2 + p.life * 10) * dt * 0.3
        p.mesh.scale.setScalar(p.size * (0.4 + k))
        ;(p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.45 * Math.sin(Math.PI * k)
        faceCamera(p.mesh)
      }

      // The lechon → paksiw jump.
      if (state === 'lechon') {
        fullFor = heat > 0.97 ? fullFor + dt : 0
        if (fullFor > BOIL) {
          state = 'jump'
          jumpT = 0
          sfx.pop()
        }
      }
      let lift = 0
      let flip = 1
      let squash = 1
      if (state === 'jump') {
        jumpT += dt
        const τ = Math.min(1, jumpT / AIR)
        lift = 4 * body.r * 1.9 * τ * (1 - τ)
        flip = Math.abs(Math.cos(2 * Math.PI * τ))
        if (cardIndex === 0 && τ >= 0.25) {
          cardIndex = 1 // edge-on: swap without anyone seeing
          cardMat.map = cardMaps[1]
          cardMat.needsUpdate = true
          sfx.swish()
        }
        if (jumpT >= AIR) {
          const l = (jumpT - AIR) / LAND
          squash = 1 - 0.18 * Math.sin(Math.PI * Math.min(1, l)) * (1 - l)
          if (jumpT - dt < AIR) {
            sfx.ding()
            emit(14, true)
            captionAt = time
          }
          if (l >= 1) state = 'paksiw'
        }
      } else if (state === 'paksiw') {
        // Back to cold: leftovers again (hidden by a puff), ready for another go.
        coldFor = heat < 0.05 ? coldFor + dt : 0
        if (coldFor > 0.6) {
          emit(10, true)
          cardIndex = 0
          cardMat.map = cardMaps[0]
          cardMat.needsUpdate = true
          state = 'lechon'
          coldFor = 0
        }
      }
      const size = cardSize(cardIndex)
      const bob = (state === 'jump' ? 0 : 1) * (Math.abs(Math.sin(time * 18)) * 0.05 * shake * body.r + Math.sin(time * 1.5) * 0.02 * body.r)
      card.position.copy(centre(restY() + lift + bob))
      faceCamera(card)
      card.scale.set(size.x * Math.max(0.02, flip) / squash, size.y * squash, 1)

      // The payoff caption pops above the pan, then floats off.
      const ca = time - captionAt
      const capMat = caption.material as THREE.MeshBasicMaterial
      capMat.opacity = ca < 0 ? 0 : clamp01(ca / 0.25) * clamp01((3.2 - ca) / 0.6)
      caption.scale.setScalar(0.8 + 0.2 * easeOutBack(clamp01(ca / 0.4)))
      caption.position.z = 0.08 + 0.006 * Math.sin(time * 1.6)

      sfx.sizzle(visible ? heat * heat : 0)
    },
    onDragStart(hit, point) {
      if (hit.object !== knob) return false // the pan: a plain tap (see onTap)
      if (!touched) touchedAt = now
      touched = true
      drag = { last: angleAt(point), start: point.clone(), moved: false }
      return true
    },
    onDragMove(point) {
      if (!drag) return
      if (point.distanceTo(drag.start) > TAP_SLOP) drag.moved = true
      if (point.distanceTo(knobCentre) < page.len(kr) * 0.15) return // too near the middle to read an angle
      const a = angleAt(point)
      let d = a - drag.last
      if (d > Math.PI) d -= 2 * Math.PI
      if (d < -Math.PI) d += 2 * Math.PI
      drag.last = a
      target = Math.min(MAX_TURN, Math.max(0, target - d)) // clockwise turns it up
    },
    onDragEnd() {
      if (!drag) return
      const tap = !drag.moved
      drag = null
      if (!tap) return
      // A tap: up a notch, or from full back to off.
      target = target >= MAX_TURN - 1e-3 ? 0 : Math.min(MAX_TURN, (Math.floor(target / TAP_STEP + 1e-3) + 1) * TAP_STEP)
    },
    onTap() {
      wiggleAt = now // poke the pan: it jiggles
      sfx.tick()
    },
    onShow() {
      visible = true
    },
    onHide() {
      visible = false
      drag = null
      sfx.sizzle(0)
    },
    dispose() {
      sfx.sizzle(0)
      flameMap.dispose()
      puffMap.dispose()
      disposeObject(root)
    },
  }
}
