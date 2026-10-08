import * as THREE from 'three'
import { BesidePageSpace } from '../coords'
import type { BesideContent } from '../types'
import { type BuildContext, type ContentNode } from './ContentNode'
import { buildContent } from './index'

/** Seconds between looks at the camera, and how many agreeing looks it takes to show or hide. */
const EVERY = 0.2
const SHOW_AFTER = 2
const HIDE_AFTER = 4
/** How closely the camera's colours must follow the print's (correlation), from how many probes. */
const MATCH = 0.6
const MIN_SEEN = 0.5

/**
 * The page beside this one (see BesideContent): its content is built here, in its own pixels, and shown
 * only while the camera sees that page where it should be, e.g. the back cover left of the front when the
 * whole wraparound cover is on screen, but not the table beside a single printed cover.
 */
export async function buildBeside(c: BesideContent, ctx: BuildContext): Promise<ContentNode> {
  const page = new BesidePageSpace(ctx.page, c.offset)
  const group = new THREE.Group()
  group.visible = false
  const nodes = await Promise.all(c.content.map((item) => buildContent(item, { ...ctx, page })))
  for (const n of nodes) {
    n.object.userData.node = n
    group.add(n.object)
  }

  const probes = c.probe.map(([x, y]) => new THREE.Vector3(...page.point([x, y]), 0))
  const world = probes.map(() => new THREE.Vector3())
  const printed = c.probe.map(([, , r, g, b]) => [r, g, b])

  /** Correlation of the camera's colours with the print's, channel by channel (so white balance doesn't matter). */
  function match(seen: ([number, number, number] | null)[]): number | null {
    const pairs = seen.flatMap((s, i) => (s ? [[s, printed[i]]] : []))
    if (pairs.length < probes.length * MIN_SEEN) return null
    let xy = 0
    let xx = 0
    let yy = 0
    for (let ch = 0; ch < 3; ch++) {
      const mx = pairs.reduce((a, [s]) => a + s[ch], 0) / pairs.length
      const my = pairs.reduce((a, [, p]) => a + p[ch], 0) / pairs.length
      for (const [s, p] of pairs) {
        const [dx, dy] = [s[ch] - mx, p[ch] - my]
        xy += dx * dy
        xx += dx * dx
        yy += dy * dy
      }
    }
    return xx > 1 && yy > 1 ? xy / Math.sqrt(xx * yy) : 0
  }

  let votes = 0
  let lookedAt = -Infinity
  let shownAt = 0
  const hide = () => {
    votes = 0
    group.visible = false
  }

  return {
    object: group,
    update(tick) {
      if (tick.time - lookedAt > EVERY) {
        lookedAt = tick.time
        group.updateWorldMatrix(true, false)
        world.forEach((w, i) => w.copy(probes[i]).applyMatrix4(group.matrixWorld))
        const seen = ctx.view.sampleCameraEach(world)
        const r = seen && match(seen)
        // Count looks in a row that disagree with what's shown; off screen (e.g. zoomed in on this page) keeps it as it is.
        if (r !== null) votes = r > MATCH === group.visible ? 0 : votes + 1
        if (!group.visible && votes >= SHOW_AFTER) {
          votes = 0
          group.visible = true
          shownAt = tick.t
          console.info(`[ar] ${c.id}: the page beside is in view`)
        } else if (group.visible && votes >= HIDE_AFTER) hide()
      }
      if (group.visible) for (const n of nodes) n.update({ ...tick, t: tick.t - shownAt })
    },
    onShow: () => nodes.forEach((n) => n.onShow?.()),
    onHide() {
      hide()
      nodes.forEach((n) => n.onHide?.())
    },
    dispose: () => nodes.forEach((n) => n.dispose()),
  }
}
