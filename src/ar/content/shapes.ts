import * as THREE from 'three'
import type { CloudContent, HeartContent, StarContent } from '../types'
import type { AssetManager } from '../AssetManager'
import { type BuildContext, type ContentNode, Pulse, disposeObject, easeOutBack, intro } from './ContentNode'

export function starShape(outer: number, inner = outer * 0.45, points = 5): THREE.Shape {
  const s = new THREE.Shape()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = Math.PI / 2 + (i * Math.PI) / points
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  s.closePath()
  return s
}

/** Printed-halftone dot pattern, matching the poster's riso/collage texture. */
function halftone(assets: AssetManager, color: string) {
  return assets.canvasTexture(`halftone:${color}`, 128, 128, (ctx) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 128, 128)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    for (let y = 0; y < 128; y += 8) {
      for (let x = (y / 8) % 2 ? 4 : 0; x < 128; x += 8) {
        ctx.beginPath()
        ctx.arc(x, y, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  })
}

export async function buildStar(c: StarContent, { page, assets }: BuildContext): Promise<ContentNode> {
  const r = page.len(c.size)
  const [x, y] = page.point(c.at)
  const lift = c.lift ?? 0.1
  const spin = c.spin ?? 0.1
  const baseRot = THREE.MathUtils.degToRad(c.rotation ?? 0)
  const phase = Math.random() * Math.PI * 2

  const geo = new THREE.ExtrudeGeometry(starShape(r), {
    depth: r * 0.18,
    bevelEnabled: true,
    bevelThickness: r * 0.06,
    bevelSize: r * 0.05,
    bevelSegments: 2,
  })
  geo.center()
  // Planar UVs so the halftone tiles evenly across the face.
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (r * 0.5), pos.getY(i) / (r * 0.5))

  const map = c.halftone ? await halftone(assets, c.color) : null
  if (map) map.wrapS = map.wrapT = THREE.RepeatWrapping
  const mat = new THREE.MeshStandardMaterial({
    color: map ? 0xffffff : c.color,
    map,
    roughness: 0.55,
    metalness: 0.05,
    emissive: new THREE.Color(c.color),
    emissiveIntensity: 0,
  })
  const mesh = new THREE.Mesh(geo, mat)
  const group = new THREE.Group()
  group.position.set(x, y, 0)
  group.add(mesh)
  const pop = new Pulse(0.9)
  let now = 0

  return {
    object: group,
    update({ t, time }) {
      now = time
      const p = intro(t, c.delay, 0.9)
      const hp = pop.value(time)
      mesh.position.z = lift * easeOutBack(p) + Math.sin(time * 1.3 + phase) * 0.01 * p
      mesh.rotation.z = baseRot + (1 - p) * -Math.PI + time * spin * Math.PI * 2
      mesh.rotation.y = Math.sin(time * 0.9 + phase) * 0.5 + hp * Math.PI * 4
      mesh.scale.setScalar(Math.max(0.001, easeOutBack(p)) * (1 + Math.sin(hp * Math.PI) * 0.35))
      mat.emissiveIntensity = (0.5 + 0.5 * Math.sin(time * 3 + phase)) * 0.25
    },
    onTap: () => pop.trigger(now),
    dispose: () => disposeObject(group),
  }
}

/** Hand-drawn-style heart outline (a tube along a heart curve), with a heartbeat. */
export async function buildHeart(c: HeartContent, { page }: BuildContext): Promise<ContentNode> {
  const size = page.len(c.size)
  const [x, y] = page.point(c.at)
  const lift = c.lift ?? 0.12
  const beatPeriod = 60 / (c.bpm ?? 70)

  // Classic parametric heart (~unit width), with a slight wobble so it reads as hand-drawn.
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2
    const hx = 16 * Math.pow(Math.sin(a), 3)
    const hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)
    const k = (size / 34) * (1 + 0.025 * Math.sin(a * 7))
    pts.push(new THREE.Vector3(hx * k, hy * k + size * 0.05, Math.sin(a * 3) * size * 0.02))
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, size * 0.035, 8, true)
  const mat = new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.4, emissive: c.color, emissiveIntensity: 0.15 })
  const mesh = new THREE.Mesh(geo, mat)
  // Invisible disc makes the whole heart tappable, not just the thin outline.
  const hit = new THREE.Mesh(new THREE.CircleGeometry(size * 0.55, 24), new THREE.MeshBasicMaterial({ visible: false }))
  mesh.add(hit)
  const group = new THREE.Group()
  group.position.set(x, y, 0)
  group.rotation.z = -0.12
  group.add(mesh)
  const extra = new Pulse(0.8)
  let now = 0

  const beat = (phase: number) => {
    // Two quick beats then rest: "lub-dub".
    const b1 = Math.exp(-Math.pow((phase - 0.08) / 0.05, 2))
    const b2 = Math.exp(-Math.pow((phase - 0.26) / 0.05, 2)) * 0.7
    return b1 + b2
  }

  return {
    object: group,
    update({ t, time }) {
      now = time
      const p = intro(t, c.delay, 0.8)
      const tapBoost = extra.value(time)
      const b = beat((time % beatPeriod) / beatPeriod) * 0.12 + (tapBoost ? beat(tapBoost * 0.5) * 0.5 : 0)
      mesh.position.z = lift * easeOutBack(p)
      mesh.scale.setScalar(Math.max(0.001, p) * (1 + b))
      mesh.rotation.y = Math.sin(time * 0.7) * 0.35
      mat.emissiveIntensity = 0.15 + b * 2
    },
    onTap: () => extra.trigger(now),
    dispose: () => disposeObject(group),
  }
}

/** Soft halftone cloud puff drifting just above the page. */
export async function buildCloud(c: CloudContent, { page, assets }: BuildContext): Promise<ContentNode> {
  const w = page.len(c.size)
  const [x, y] = page.point(c.at)
  const lift = c.lift ?? 0.05
  const drift = page.len(c.drift ?? 20)
  const phase = Math.random() * Math.PI * 2
  const map = await assets.canvasTexture('cloud', 256, 128, (ctx) => {
    const puffs: [number, number, number][] = [
      [70, 80, 42],
      [120, 62, 52],
      [175, 76, 44],
      [100, 92, 36],
      [150, 94, 36],
    ]
    for (const [px, py, pr] of puffs) {
      const g = ctx.createRadialGradient(px, py, pr * 0.2, px, py, pr)
      g.addColorStop(0, 'rgba(255,255,255,0.95)')
      g.addColorStop(0.7, 'rgba(255,255,255,0.75)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(px, py, pr, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity: 0 })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), mat)
  mesh.renderOrder = 2
  const group = new THREE.Group()
  group.position.set(x, y, lift)
  group.add(mesh)

  return {
    object: group,
    update({ t, time }) {
      const p = intro(t, c.delay, 1.2)
      mesh.position.x = Math.sin(time * 0.25 + phase) * drift
      mesh.position.z = Math.sin(time * 0.5 + phase) * 0.01
      mat.opacity = 0.85 * p
    },
    dispose: () => disposeObject(group),
  }
}
