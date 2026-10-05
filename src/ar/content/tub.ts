import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { TubContent } from '../types'
import { type BuildContext, type ContentNode, Pulse, clamp01, disposeObject, easeOutBack, intro } from './ContentNode'

/**
 * p34 "The Ice Cream is Gone": the Selecta tub lying lengthways on the printed (portrait) tray. Tap it and the lid comes off
 * and is set down beside it, the three scoops pop up and vanish, and a fish is left flopping inside.
 * Tap the fish to make it flop again; tap the tub to put everything back.
 *
 * The whole sequence is one progress value (0 closed … 1 revealed), eased towards its target, so it
 * reverses cleanly from any point. The GLB's own clips assume Blender gravity, so motion is procedural.
 */

/** Seconds into the sequence when each beat starts and how long it runs. */
const BEAT = {
  lid: [0, 1.3],
  /** Scoops leave one after another, `stagger` apart, once the ice cream has been seen for a moment. */
  scoops: [1.6, 0.9],
  stagger: 0.22,
  fish: [2.7, 0.6],
}
const LENGTH = 3.4
const OPEN_RATE = 1 / LENGTH
const CLOSE_RATE = 2 / LENGTH

const smooth = (x: number) => x * x * (3 - 2 * x)
const phase = (T: number, [start, dur]: number[]) => clamp01((T - start) / dur)
const name = (n: string) => THREE.PropertyBinding.sanitizeNodeName(n)

function shadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(40, 14, 10, 0.55)')
  g.addColorStop(0.55, 'rgba(40, 14, 10, 0.3)')
  g.addColorStop(1, 'rgba(40, 14, 10, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

export async function buildTub(c: TubContent, { page, assets, view }: BuildContext): Promise<ContentNode> {
  const gltf = await assets.gltf(c.asset)
  const model = cloneSkinned(gltf.scene)
  model.updateMatrixWorld(true)

  // Soft studio reflections, but toned down (darker, a little desaturated) to sit with a phone camera's
  // flatter, dimmer picture rather than glowing like a render.
  const env = view.environment()
  const hsl = { h: 0, s: 0, l: 0 }
  model.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    for (const m of [mesh.material].flat() as THREE.MeshStandardMaterial[]) {
      if (!m.isMeshStandardMaterial) continue
      m.envMap = env
      m.envMapIntensity = 0.35
      m.color.getHSL(hsl)
      m.color.setHSL(hsl.h, hsl.s * 0.8, hsl.l * 0.82)
      // Textured colours can't be desaturated per pixel here, so damp them a little more.
      if (m.map) m.color.multiplyScalar(0.9)
      // The fish was exported as a perfect mirror; give it a wet sheen instead.
      if (m.name === 'Medeka fish') m.roughness = 0.35
    }
  })

  const get = (n: string) => {
    const o = model.getObjectByName(name(n))
    if (!o) throw new Error(`[ar] ${c.asset} has no "${n}"`)
    return o
  }
  const tub = get('box_mesh')
  const lid = get('Empty.001')
  const scoops = ['Sphere.001', 'Sphere.003', 'Sphere.002'].map(get) // choco, keso, ube: left to right
  // Move the fish by its armature root: a direct child of the scene, so offsets are in model units
  // (the mesh itself sits under an 89× scale).
  const fish = get('Madeka fish')
  const fishCentre = new THREE.Box3().setFromObject(get('Medeka fish')).getCenter(new THREE.Vector3())
  const bones = ['Bone', 'Bone.001', 'Bone.002', 'Bone.004'].map(get)

  // The tub lies on the page with its opening facing up out of it (glTF +Z), label reading up the page.
  const tubBox = new THREE.Box3().setFromObject(tub)
  const tubSize = tubBox.getSize(new THREE.Vector3())
  const tubCentre = tubBox.getCenter(new THREE.Vector3())
  model.position.set(-tubCentre.x, -tubCentre.y, -tubBox.min.z)
  const lidBox = new THREE.Box3().setFromObject(lid)

  const group = new THREE.Group()
  const [x, y] = page.point(c.at)
  group.position.set(x, y, c.lift ?? 0)
  // Turned a quarter anticlockwise so its length runs up the page like the tray, with the fish's head
  // at the top like the printed ones. In this turned space, model −y points to the page's right.
  const turn = new THREE.Group()
  turn.rotation.z = Math.PI / 2
  turn.add(model)
  group.add(turn)
  const k = page.len(c.length) / tubSize.x // model units → anchor units

  // Soft contact shadows: one under the tub, one under the lid once it's set down.
  const shadowMap = shadowTexture()
  const shadowMat = () => new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, toneMapped: false })
  const tubShadow = new THREE.Mesh(new THREE.PlaneGeometry(tubSize.x * 1.25, tubSize.y * 1.3), shadowMat())
  tubShadow.position.set(-tubSize.x * 0.03, -tubSize.y * 0.03, 0.002) // light from the page's top-left
  const lidShadow = new THREE.Mesh(new THREE.PlaneGeometry(tubSize.x * 1.2, tubSize.y * 1.25), shadowMat())
  lidShadow.position.z = 0.002
  turn.add(tubShadow, lidShadow)

  // Rest poses, so every frame is computed from scratch (and reversing needs no bookkeeping).
  const rest = new Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>()
  for (const o of [lid, fish, ...scoops, ...bones]) rest.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() })
  const restOf = (o: THREE.Object3D) => rest.get(o)!

  // Lid: lifts, tips, swings out to the page's right (model −y) and settles flat on the page beside the tub.
  const lidAside = new THREE.Vector3(-tubSize.x * 0.06, -tubSize.y * 1.04, -(lidBox.min.z - tubBox.min.z) + 0.02)
  const tip = new THREE.Quaternion()
  const Z = new THREE.Vector3(0, 0, 1)
  const Y = new THREE.Vector3(0, 1, 0)
  const X = new THREE.Vector3(1, 0, 0)
  function placeLid(u: number, hop: number) {
    const r = restOf(lid)
    const e = smooth(u)
    const arc = Math.sin(Math.PI * u) * tubSize.z * 0.9 // up and over, not through the rim
    lid.position.copy(r.p).addScaledVector(lidAside, e)
    lid.position.z += arc + hop * tubSize.z * 0.12
    tip.setFromAxisAngle(X, -Math.sin(Math.PI * u) * 0.45 - hop * 0.04)
    lid.quaternion.copy(tip).multiply(r.q)
    const shadowOn = smooth(clamp01((u - 0.55) / 0.45))
    lidShadow.position.x = r.p.x - tubCentre.x + lidAside.x * e - tubSize.x * 0.03
    lidShadow.position.y = r.p.y - tubCentre.y + lidAside.y * e - tubSize.y * 0.03
    ;(lidShadow.material as THREE.MeshBasicMaterial).opacity = shadowOn * 0.8
    lidShadow.visible = shadowOn > 0.01
  }

  // Scoops: pop up towards the phone, fanning out a little sideways (model ±y), tumbling, and shrink away.
  const spin = new THREE.Quaternion()
  function placeScoop(o: THREE.Object3D, i: number, u: number) {
    const r = restOf(o)
    const pop = smooth(u)
    o.visible = u < 0.999
    o.position.copy(r.p)
    o.position.x += (1 - i) * tubSize.x * 0.08 * pop
    o.position.y += (i - 1 || 0.6) * tubSize.y * 0.3 * pop
    o.position.z += tubSize.x * 1.1 * pop + Math.sin(Math.PI * u) * tubSize.z * 0.6
    spin.setFromAxisAngle(i === 1 ? X : Z, (i - 1 || 1) * pop * Math.PI * 1.5)
    o.quaternion.copy(spin).multiply(r.q)
    const grow = 1 + 0.25 * Math.sin(Math.PI * Math.min(1, u * 2)) // a squash-and-pop as it leaves
    o.scale.copy(r.s).multiplyScalar(Math.max(0.001, grow * (1 - u * u)))
  }

  // Fish: grown to fill the tub (like the bangus on the printed tray), with a tail wag through the
  // bone chain plus a whole-body flop (a hop and a roll).
  const FISH_SIZE = 1.35
  const flop = new Pulse(0.9)
  const wag = new THREE.Quaternion()
  function placeFish(reveal: number, time: number) {
    const r = restOf(fish)
    const f = flop.value(time)
    const hop = Math.sin(Math.PI * f) // 0 at rest, 1 mid-flop
    const lively = reveal * (0.35 + 0.65 * hop)
    bones.forEach((b, i) => {
      const br = restOf(b)
      wag.setFromAxisAngle(Y, Math.sin(time * 9 - i * 0.9) * 0.3 * lively * (0.5 + i * 0.25))
      b.quaternion.copy(br.q).multiply(wag)
    })
    // A little "boing" as the last scoop leaves; all scaling and rolling is about the fish's own centre.
    const size = FISH_SIZE * (1 + 0.15 * Math.sin(Math.PI * reveal) * (reveal < 1 ? 1 : 0))
    tip.setFromAxisAngle(X, Math.sin(f * Math.PI * 2) * 0.35 * reveal)
    fish.quaternion.copy(tip).multiply(r.q)
    fish.scale.copy(r.s).multiplyScalar(size)
    fish.position.copy(r.p).sub(fishCentre).multiplyScalar(size).applyQuaternion(tip).add(fishCentre)
    fish.position.z += hop * tubSize.z * 0.5 * reveal
  }

  let progress = 0
  let target = 0
  let nextHop = 2.5
  let lastIdleFlop = 0
  let now = 0
  const lidHop = new Pulse(0.5)

  function pose(time: number) {
    const T = progress * LENGTH
    const lidU = phase(T, BEAT.lid)
    placeLid(lidU, lidU === 0 ? Math.sin(Math.PI * lidHop.value(time)) : 0)
    scoops.forEach((s, i) => placeScoop(s, i, phase(T, [BEAT.scoops[0] + i * BEAT.stagger, BEAT.scoops[1]])))
    placeFish(smooth(phase(T, BEAT.fish)), time)
  }
  pose(0)

  const fishMeshes = new Set<THREE.Object3D>()
  fish.traverse((o) => fishMeshes.add(o))

  return {
    object: group,
    update({ t, dt, time }) {
      now = time
      const pop = Math.max(0.001, easeOutBack(intro(t, c.delay, 0.8)))
      group.scale.setScalar(k * pop)
      const rate = target > progress ? OPEN_RATE : CLOSE_RATE
      progress = target > progress ? Math.min(target, progress + rate * dt) : Math.max(target, progress - rate * dt)
      // Closed: the lid gives a little hop now and then, inviting a tap. Open: the fish flops by itself.
      if (progress === 0 && target === 0 && t > nextHop) {
        lidHop.trigger(time)
        nextHop = t + 3.2
      }
      if (progress === 1 && time - lastIdleFlop > 3.5) {
        flop.trigger(time)
        lastIdleFlop = time
      }
      pose(time)
    },
    onTap(hit) {
      if (target === 0) {
        target = 1
        lastIdleFlop = now + LENGTH * (1 - progress) // first idle flop a beat after the reveal
      } else if (progress === 1 && fishMeshes.has(hit.object)) {
        flop.trigger(now)
        lastIdleFlop = now
      } else target = 0
    },
    onShow() {
      nextHop = 1.2
    },
    dispose() {
      shadowMap.dispose()
      disposeObject(group)
    },
  }
}
