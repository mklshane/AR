import * as THREE from 'three'
import type { CutoutContent } from '../types'
import { type BuildContext, type ContentNode, Pulse, disposeObject, easeOutBack, intro } from './ContentNode'

/** A crop of the page that peels up off the paper and floats, with a soft shadow left on the page. */
export async function buildCutout(c: CutoutContent, ctx: BuildContext): Promise<ContentNode> {
  const { page } = ctx
  const [map, shape] = await Promise.all([
    ctx.assets.crop(ctx.targetImage, c.crop, c.keySky),
    ctx.assets.crop(ctx.targetImage, c.crop, c.keySky, true),
  ])
  const [x0, y0, x1, y1] = c.crop
  const w = page.len(x1 - x0)
  const h = page.len(y1 - y0)
  const [x, y] = page.point(c.at)
  const lift = c.lift ?? 0.05
  const bob = c.bob ?? 0.004
  const wobble = THREE.MathUtils.degToRad(c.wobble ?? 1)
  const phase = Math.random() * Math.PI * 2
  const hop = new Pulse(0.7)
  let now = 0

  const geo = new THREE.PlaneGeometry(w, h)
  const sticker = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide }),
  )
  const shadow = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ map: shape, color: 0x0b1f3a, transparent: true, opacity: 0, depthWrite: false }),
  )
  shadow.renderOrder = -1

  const group = new THREE.Group()
  group.position.set(x, y, 0)
  group.add(shadow, sticker)

  // Flat patch over the printed original, slightly dilated to cover anti-aliased edges.
  const hole = c.hole
    ? new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: shape, color: c.hole, transparent: true, opacity: 0, depthWrite: false }))
    : null
  if (hole) {
    hole.renderOrder = -2
    hole.scale.setScalar(1.04)
    hole.position.z = 0.0003
    group.add(hole)
  }

  return {
    object: group,
    update({ t, time }) {
      now = time
      const p = intro(t, c.delay)
      const hp = hop.value(time)
      const z = lift * easeOutBack(p) + Math.sin(time * 1.6 + phase) * bob * p + Math.sin(hp * Math.PI) * lift
      sticker.position.z = Math.max(0.001, z)
      sticker.rotation.z = Math.sin(time * 1.1 + phase) * wobble * p + (hp ? easeOutBack(hp) * Math.PI * 2 : 0)
      sticker.scale.setScalar(1 + 0.04 * p)
      // Shadow slides away from a light up-left and fades in as the sticker rises.
      shadow.position.set(z * 0.35, -z * 0.45, 0.0005)
      ;(shadow.material as THREE.MeshBasicMaterial).opacity = 0.35 * p
      if (hole) (hole.material as THREE.MeshBasicMaterial).opacity = p
    },
    onTap: () => hop.trigger(now),
    dispose: () => disposeObject(group),
  }
}
