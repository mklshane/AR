import * as THREE from 'three'
import type { AssetManager } from '../ar/AssetManager'
import { PageSpace } from '../ar/coords'
import type { ContentNode, Tick } from '../ar/content/ContentNode'
import { buildContent } from '../ar/content'
import { TapBurst } from '../ar/content/TapBurst'
import type { TargetConfig } from '../ar/types'

/**
 * Everything attached to one target, built from its config. The engine never knows what the content
 * is: a new magazine page is a new TargetConfig, not new code.
 */
export class TargetScene {
  readonly root = new THREE.Group()
  private nodes: ContentNode[] = []
  private burst?: TapBurst
  private config: TargetConfig

  constructor(config: TargetConfig) {
    this.config = config
  }

  /** Builds all content. Items that fail (e.g. a missing GLB) are skipped and reported, not fatal. */
  async build(assets: AssetManager): Promise<string[]> {
    const ctx = { assets, page: new PageSpace(this.config.size), targetImage: this.config.image }
    const results = await Promise.allSettled(this.config.content.map((item) => buildContent(item, ctx)))
    const failures: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        r.value.object.userData.node = r.value
        this.nodes.push(r.value)
        this.root.add(r.value.object)
      } else {
        const item = this.config.content[i]
        console.error(`[ar] failed to build ${item.type} "${item.id}"`, r.reason)
        failures.push(item.id)
      }
    })
    if (this.config.tapBurst) {
      this.burst = new TapBurst(this.config.tapBurst.colors)
      this.root.add(this.burst.object)
    }
    return failures
  }

  show() {
    this.nodes.forEach((n) => n.onShow?.())
  }

  hide() {
    this.nodes.forEach((n) => n.onHide?.())
  }

  update(tick: Tick) {
    for (const n of this.nodes) n.update(tick)
    this.burst?.update(tick.dt)
  }

  /** Handle a tap ray hit on this target's content (or on the page plane). */
  tap(hit: THREE.Intersection | null, pagePoint: THREE.Vector3 | null) {
    let o: THREE.Object3D | null = hit?.object ?? null
    while (o && !o.userData.node) o = o.parent
    ;(o?.userData.node as ContentNode | undefined)?.onTap?.()
    const at = hit ? this.root.worldToLocal(hit.point.clone()) : pagePoint
    if (at) this.burst?.fire(at)
  }

  /** Meshes eligible for tap raycasts. */
  get tappables(): THREE.Object3D[] {
    return this.nodes.map((n) => n.object)
  }

  dispose() {
    this.nodes.forEach((n) => n.dispose())
    this.burst?.dispose()
    this.nodes = []
  }
}
