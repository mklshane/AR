import * as THREE from 'three'
import type { AssetManager } from './AssetManager'
import { DEFAULT_POSE_FILTER, PoseFilter, type PoseFilterOptions } from './PoseFilter'
import type { TargetConfig } from './types'
import type { ContentNode, ViewServices } from './content/ContentNode'
import { TargetScene } from '../scenes/TargetScene'

/** Re-detections within this many seconds don't replay the intro animation (avoids flicker restarts). */
const REINTRO_AFTER_S = 2

const HIDDEN = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1)

interface Anchor {
  config: TargetConfig
  group: THREE.Group
  /** MindAR world matrix → our page space (origin at centre, 1 unit = page width). */
  postMatrix: THREE.Matrix4
  /** Latest unfiltered pose from the tracker; smoothed into group.matrix on each sample. */
  rawPose: THREE.Matrix4
  filter: PoseFilter | null
  scene?: TargetScene
  building?: Promise<void>
  visible: boolean
  /** Shared by every target in the same `group`, so switching between them doesn't replay the intro. */
  timing: { foundAt: number; lostAt: number }
}

export interface TargetEvents {
  found: { config: TargetConfig }
  lost: { config: TargetConfig }
  contentError: { config: TargetConfig; ids: string[] }
}

export class TargetManager {
  private anchors = new Map<number, Anchor>()
  private scene: THREE.Scene
  private assets: AssetManager
  private onEvent: <K extends keyof TargetEvents>(e: K, p: TargetEvents[K]) => void
  private debug: boolean
  private smoothing: boolean
  private poseFilter: PoseFilterOptions
  private view: ViewServices
  private groups = new Map<string, Anchor['timing']>()

  constructor(
    scene: THREE.Scene,
    assets: AssetManager,
    onEvent: <K extends keyof TargetEvents>(e: K, p: TargetEvents[K]) => void,
    view: ViewServices,
    { debug = false, smoothing = true, poseFilter = {} as Partial<PoseFilterOptions> } = {},
  ) {
    this.view = view
    this.poseFilter = { ...DEFAULT_POSE_FILTER, ...poseFilter }
    this.scene = scene
    this.assets = assets
    this.onEvent = onEvent
    this.debug = debug
    this.smoothing = smoothing
  }

  /** Register targets once the .mind file reports each target's pixel dimensions. */
  register(targets: TargetConfig[], dimensions: [number, number][]) {
    for (const config of targets) {
      const dim = dimensions[config.targetIndex]
      if (!dim) {
        console.warn(`[ar] target "${config.id}" has index ${config.targetIndex}, but the .mind file has ${dimensions.length} target(s)`)
        continue
      }
      const [w, h] = dim
      const postMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3(w / 2, h / 2, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(w, w, w),
      )
      const group = new THREE.Group()
      group.matrixAutoUpdate = false
      group.visible = false
      if (this.debug) group.add(debugFrame(h / w))
      this.scene.add(group)
      this.anchors.set(config.targetIndex, {
        config,
        group,
        postMatrix,
        rawPose: new THREE.Matrix4(),
        filter: this.smoothing ? new PoseFilter({ ...this.poseFilter, ...config.poseFilter }) : null,
        visible: false,
        timing: this.timingFor(config),
      })
    }
  }

  private timingFor(config: TargetConfig): Anchor['timing'] {
    const fresh = { foundAt: 0, lostAt: -Infinity }
    if (!config.group) return fresh
    if (!this.groups.has(config.group)) this.groups.set(config.group, fresh)
    return this.groups.get(config.group)!
  }

  /** Called from MindAR's onUpdate with the target's world matrix (or null when lost). */
  update(targetIndex: number, worldMatrix: number[] | null, now: number) {
    const a = this.anchors.get(targetIndex)
    if (!a) return
    if (worldMatrix) {
      a.rawPose.fromArray(worldMatrix).multiply(a.postMatrix)
      if (!a.visible) a.filter?.reset()
      if (a.filter) {
        a.filter.push(a.rawPose, now)
        a.filter.sample(a.group.matrix)
      } else a.group.matrix.copy(a.rawPose)
      if (!a.visible) {
        a.visible = true
        a.group.visible = true
        if (now - a.timing.lostAt > REINTRO_AFTER_S) a.timing.foundAt = now
        this.ensureScene(a)
        a.scene?.show()
        console.info(`[ar] target found: ${a.config.id}`)
        this.onEvent('found', { config: a.config })
      }
    } else {
      a.group.matrix.copy(HIDDEN)
      if (a.visible) {
        a.visible = false
        a.group.visible = false
        a.timing.lostAt = now
        a.scene?.hide()
        console.info(`[ar] target lost: ${a.config.id}`)
        this.onEvent('lost', { config: a.config })
      }
    }
    a.group.matrixWorldNeedsUpdate = true
  }

  /**
   * Build every target's content in idle time, one target at a time, so a page appears instantly
   * the first time it is found. Targets with `prefetch: false` (e.g. heavy video/GLB pages) are left
   * to build on first detection.
   */
  prebuildWhenIdle() {
    const queue = [...this.anchors.values()].filter((a) => a.config.prefetch !== false)
    const next = () => {
      const a = queue.shift()
      if (!a) return
      const run = () => {
        this.ensureScene(a)
        ;(a.building ?? Promise.resolve()).finally(next)
      }
      if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2000 })
      else setTimeout(run, 200)
    }
    next()
  }

  /** Lazy content build (on idle prebuild or first detection, whichever comes first). */
  private ensureScene(a: Anchor) {
    if (a.scene || a.building) return
    const scene = new TargetScene(a.config)
    const t0 = performance.now()
    a.building = scene.build(this.assets, this.view).then((failed) => {
      console.info(`[ar] timing build ${a.config.id} ${Math.round(performance.now() - t0)}ms`)
      a.scene = scene
      a.group.add(scene.root)
      // Built after the page was found (a lazy page): start its entrance now that there's something to show,
      // rather than skipping it because the clock started at detection.
      if (a.visible) {
        a.timing.foundAt = Infinity
        scene.show()
      }
      if (failed.length) this.onEvent('contentError', { config: a.config, ids: failed })
    })
  }

  tick(now: number, dt: number) {
    for (const a of this.anchors.values()) {
      if (!a.visible) continue
      if (a.timing.foundAt === Infinity) a.timing.foundAt = now
      a.scene?.update({ t: now - a.timing.foundAt, dt, time: now })
    }
  }

  /** Raycast a tap against visible targets' content; falls back to the page plane for the burst. */
  tap(raycaster: THREE.Raycaster) {
    for (const a of this.anchors.values()) {
      if (!a.visible || !a.scene) continue
      a.group.updateMatrixWorld(true)
      const hit = raycaster.intersectObjects(a.scene.tappables, true)[0] ?? null
      a.scene.tap(hit, hit ? null : this.pagePoint(a, raycaster))
    }
  }

  /** Where a ray meets a target's page plane, in that target's page space (null if it misses). */
  private pagePoint(a: Anchor, raycaster: THREE.Raycaster): THREE.Vector3 | null {
    if (!a.scene) return null
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(a.group.matrixWorld)
    const origin = new THREE.Vector3().setFromMatrixPosition(a.group.matrixWorld)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin)
    const p = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
    if (!p) return null
    const local = a.scene.root.worldToLocal(p)
    local.z = 0
    return local
  }

  private drag: { anchor: Anchor; node: ContentNode } | null = null

  /** Offer a finger-down to draggable content; true if some node took it as a drag. */
  dragStart(raycaster: THREE.Raycaster): boolean {
    for (const a of this.anchors.values()) {
      if (!a.visible || !a.scene) continue
      a.group.updateMatrixWorld(true)
      const hit = raycaster.intersectObjects(a.scene.tappables, true)[0]
      const node = hit && a.scene.nodeOf(hit)
      const at = this.pagePoint(a, raycaster)
      if (node?.onDragStart && at && node.onDragStart(hit, at)) {
        this.drag = { anchor: a, node }
        return true
      }
    }
    return false
  }

  dragMove(raycaster: THREE.Raycaster) {
    if (!this.drag) return
    const { anchor, node } = this.drag
    if (!anchor.visible) return // hold still until the page is back (or the finger lifts)
    anchor.group.updateMatrixWorld(true)
    const at = this.pagePoint(anchor, raycaster)
    if (at) node.onDragMove?.(at)
  }

  dragEnd(raycaster: THREE.Raycaster | null) {
    if (!this.drag) return
    const { anchor, node } = this.drag
    this.drag = null
    const at = raycaster && anchor.visible ? this.pagePoint(anchor, raycaster) : null
    node.onDragEnd?.(at)
  }

  get dragging() {
    return this.drag !== null
  }

  /** Dev/test hook: raw vs displayed pose of each visible target. */
  debugPoses() {
    return [...this.anchors.values()]
      .filter((a) => a.visible)
      .map((a) => ({ id: a.config.id, raw: a.rawPose.toArray(), shown: a.group.matrix.toArray(), noise: a.filter?.noise, samples: a.filter?.samples ?? 0 }))
  }

  get anyVisible() {
    for (const a of this.anchors.values()) if (a.visible) return true
    return false
  }

  dispose() {
    for (const a of this.anchors.values()) {
      a.scene?.dispose()
      this.scene.remove(a.group)
    }
    this.anchors.clear()
  }
}

/** ?debug: outline of the page + axes, to check anchoring and content placement. */
function debugFrame(aspect: number) {
  const g = new THREE.Group()
  const pts = [
    [-0.5, aspect / 2],
    [0.5, aspect / 2],
    [0.5, -aspect / 2],
    [-0.5, -aspect / 2],
  ].map(([x, y]) => new THREE.Vector3(x, y, 0))
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x00ff88 })))
  g.add(new THREE.AxesHelper(0.25))
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshNormalMaterial())
  cube.position.z = 0.1
  g.add(cube)
  return g
}
