import * as THREE from 'three'
import * as sfx from '../sfx'
import type { BeesContent, FlyingBee } from '../types'
import { type BuildContext, type ContentNode, clamp01, disposeObject } from './ContentNode'

/**
 * p16's three bee species come off the page and fly. Each printed bee is cut into a body and a wing layer
 * (the wings flap about their hinge), and a patch of clean page covers the spot it leaves. They take off
 * one after another, loop around the page, and settle back on their spots for a rest before going again.
 * Tap a bee for a quick zip and a buzz.
 */

/** Seconds: resting before take-off (plus each bee's own delay), flying, landing. */
const REST = 2.2
const FLY = 9
const LAND = 1.3
const TAKEOFF = 0.7
const CYCLE = REST + TAKEOFF + FLY + LAND
/** Flight height above the page (page widths) and wing beats per second. */
const CRUISE = 0.09
const BEAT = 13

/** The page's paper in the artwork (sRGB 255, 254, 248), and how often to re-read it from the camera. */
const PAPER = new THREE.Color().setRGB(255 / 255, 254 / 255, 248 / 255, THREE.SRGBColorSpace)
const PAPER_EVERY = 0.3

const smooth = (x: number) => x * x * (3 - 2 * x)

function shadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(60, 40, 10, 0.5)')
  g.addColorStop(1, 'rgba(60, 40, 10, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

interface Bee {
  cfg: FlyingBee
  root: THREE.Group
  flip: THREE.Group
  wings: THREE.Object3D
  shadow: THREE.Mesh
  home: THREE.Vector3
  w: number
  h: number
  facing: number
  zip: number
  phase: number
}

export async function buildBees(c: BeesContent, { page, assets, view }: BuildContext): Promise<ContentNode> {
  const group = new THREE.Group()
  const shadowMap = shadowTexture()
  const plane = (map: THREE.Texture, w: number, h: number) =>
    new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }))

  const bees: Bee[] = await Promise.all(
    c.bees.map(async (cfg, i) => {
      const [body, wingMap, spot] = await Promise.all([
        assets.texture(cfg.body),
        assets.texture(cfg.wings),
        cfg.spot ? assets.texture(cfg.spot) : Promise.resolve(null),
      ])
      const img = body.image as HTMLImageElement
      const w = page.len(cfg.width)
      const h = (w * img.height) / img.width
      const home = new THREE.Vector3(...page.point(cfg.at), 0)

      // The clean page where the bee was printed.
      if (spot) {
        const spotMesh = plane(spot, w, h)
        spotMesh.position.copy(home).setZ(0.0006)
        spotMesh.renderOrder = 1
        group.add(spotMesh)
      }

      const shadow = plane(shadowMap, w * 0.8, h * 0.5)
      shadow.renderOrder = 2
      group.add(shadow)

      // root: position; flip: faces left/right; inside, the body and the wings hinged at their root.
      const root = new THREE.Group()
      const flip = new THREE.Group()
      root.add(flip)
      const bodyMesh = plane(body, w, h)
      bodyMesh.renderOrder = 10 + i * 2
      flip.add(bodyMesh)
      const [hx, hy] = [(cfg.hinge[0] - 0.5) * w, (0.5 - cfg.hinge[1]) * h]
      const wings = new THREE.Group()
      wings.position.set(hx, hy, 0.0004)
      const wingMesh = plane(wingMap, w, h)
      wingMesh.position.set(-hx, -hy, 0)
      wingMesh.renderOrder = 11 + i * 2
      wings.add(wingMesh)
      flip.add(wings)
      root.position.copy(home)
      group.add(root)
      return { cfg, root, flip, wings, shadow, home, w, h, facing: 1, zip: -Infinity, phase: i * 1.7 }
    }),
  )

  // The clean spots are the digital page; on camera the paper reads greyer/warmer, so tint them to match
  // what the camera sees just around each spot (as p13's patch does), or they'd glow white.
  const spots = group.children.filter((o) => o.renderOrder === 1) as THREE.Mesh[]
  const paperPoints = bees.flatMap((b) => {
    const [dx, dy] = [b.w * 0.62, b.h * 0.62]
    return [[-dx, dy], [dx, dy], [-dx, -dy], [dx, -dy], [0, dy * 1.15], [0, -dy * 1.15]].map(([x, y]) => new THREE.Vector3(b.home.x + x, b.home.y + y, 0))
  })
  const paperWorld = paperPoints.map(() => new THREE.Vector3())
  const tone = new THREE.Color(1, 1, 1)
  let paperAt = -Infinity

  const at = new THREE.Vector3()
  const ahead = new THREE.Vector3()

  /** Where bee `b` is on its loop at time `s` (anchor space), around its own corner of the page and beyond. */
  function loop(b: Bee, s: number, out: THREE.Vector3) {
    const [cx, cy] = page.point(b.cfg.orbit)
    const [rx, ry] = [page.len(b.cfg.radius[0]), page.len(b.cfg.radius[1])]
    const p = s * 0.55 + b.phase
    return out.set(
      cx + rx * Math.sin(p) + rx * 0.25 * Math.sin(p * 2.3 + 1),
      cy + ry * Math.sin(p * 1.6 + 0.4) + ry * 0.2 * Math.cos(p * 3.1),
      CRUISE * (1 + 0.35 * Math.sin(p * 1.3)),
    )
  }

  /** Bee position at clock `t` (seconds since the page was found). */
  function where(b: Bee, t: number, out: THREE.Vector3): { flying: number } {
    const local = t - (b.cfg.delay ?? 0)
    const k = ((local % CYCLE) + CYCLE) % CYCLE
    if (local < 0 || k < REST) {
      out.copy(b.home)
      return { flying: 0 }
    }
    const s = k - REST
    if (s < TAKEOFF) {
      // Straight up off the page, then ease into the loop.
      const u = smooth(s / TAKEOFF)
      loop(b, 0, out)
      out.lerpVectors(b.home, out, u * u)
      out.z = THREE.MathUtils.lerp(0, CRUISE, Math.sqrt(u))
      return { flying: u }
    }
    if (s < TAKEOFF + FLY) {
      const u = s - TAKEOFF
      loop(b, u, out)
      return { flying: 1 }
    }
    const u = smooth(clamp01((s - TAKEOFF - FLY) / LAND))
    loop(b, FLY, out)
    out.lerp(b.home, u)
    out.z *= 1 - u
    return { flying: 1 - u * u }
  }

  let now = 0
  return {
    object: group,
    update({ t, dt, time }) {
      now = time
      if (spots.length && time - paperAt > PAPER_EVERY) {
        paperAt = time
        group.updateWorldMatrix(true, false)
        paperWorld.forEach((w, i) => w.copy(paperPoints[i]).applyMatrix4(group.matrixWorld))
        const seen = view.sampleCamera(paperWorld)
        if (seen) {
          const want = new THREE.Color(Math.min(1, seen.r / PAPER.r), Math.min(1, seen.g / PAPER.g), Math.min(1, seen.b / PAPER.b))
          tone.lerp(want, tone.r === 1 && tone.g === 1 && tone.b === 1 ? 1 : 0.5)
          for (const m of spots) (m.material as THREE.MeshBasicMaterial).color.copy(tone)
        }
      }
      for (const b of bees) {
        const { flying } = where(b, t, at)
        // A tap: a quick zip forwards and a hop.
        const z = clamp01((time - b.zip) / 0.6)
        const zip = z > 0 && z < 1 ? Math.sin(Math.PI * z) : 0
        b.root.position.copy(at)
        b.root.position.x += b.facing * -zip * b.w * 0.4
        b.root.position.z += zip * 0.04 + flying * 0.006 * Math.sin(time * 9 + b.phase)

        // Face the way it's going (the drawings face left, or right if `facesRight`), banking with the climb.
        where(b, t + 0.08, ahead)
        const vx = ahead.x - at.x
        const vy = ahead.y - at.y
        if (flying > 0.2 && Math.abs(vx) > 0.0015) {
          const want = (vx > 0) === !b.cfg.facesRight ? -1 : 1
          b.facing += (want - b.facing) * (1 - Math.exp(-10 * dt))
        } else if (flying === 0) b.facing += (1 - b.facing) * (1 - Math.exp(-6 * dt))
        b.flip.scale.x = Math.abs(b.facing) < 0.05 ? 0.05 * Math.sign(b.facing || 1) : b.facing
        const bank = THREE.MathUtils.clamp(vy * 3, -0.22, 0.22) * (vx > 0 ? 1 : -1)
        b.root.rotation.z += (flying * bank - b.root.rotation.z) * (1 - Math.exp(-6 * dt))

        // Wings: a fast beat while flying (folding towards the hinge), an occasional twitch at rest.
        const beat = 0.25 + 0.75 * Math.abs(Math.sin(time * BEAT * Math.PI + b.phase))
        const twitch = Math.max(0, Math.sin(time * 1.3 + b.phase * 3)) ** 40
        b.wings.scale.y = flying > 0 ? THREE.MathUtils.lerp(1, beat, Math.min(1, flying * 2)) : 1 - 0.3 * twitch

        // Shadow on the page under it: tighter and darker close to the page.
        const lift = clamp01(b.root.position.z / (CRUISE * 1.4))
        b.shadow.position.set(b.root.position.x + 0.01 + lift * 0.03, b.root.position.y - 0.012 - lift * 0.04, 0.0008)
        b.shadow.scale.setScalar(0.8 + lift * 0.5)
        ;(b.shadow.material as THREE.MeshBasicMaterial).opacity = (0.32 - lift * 0.2) * clamp01(flying * 3 + 0.3)

        // Buzz as it lifts off.
        const local = t - (b.cfg.delay ?? 0)
        const k = ((local % CYCLE) + CYCLE) % CYCLE
        const prev = (((local - dt) % CYCLE) + CYCLE) % CYCLE
        if (local > 0 && prev < REST && k >= REST) sfx.bzz(0.7, b.cfg.pitch ?? 1)
      }
    },
    onTap(hit) {
      const b = bees.find((x) => x.root.getObjectById(hit.object.id))
      if (!b) return
      b.zip = now
      sfx.bzz(0.45, (b.cfg.pitch ?? 1) * 1.2)
    },
    dispose() {
      shadowMap.dispose()
      disposeObject(group)
    },
  }
}
