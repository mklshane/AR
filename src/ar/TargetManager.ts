import * as THREE from 'three'
import type { AssetManager } from './AssetManager'
import { DEFAULT_POSE_FILTER, PoseFilter, type PoseFilterOptions } from './PoseFilter'
import type { TargetConfig } from './types'
import { TargetScene } from '../scenes/TargetScene'

/** Re-detections within this many seconds don't replay the intro animation (avoids flicker restarts). */
const REINTRO_AFTER_S = 2

const HIDDEN = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1)

interface Anchor {
  config: TargetConfig
  group: THREE.Group
  /** MindAR world matrix → our page space (origin at centre, 1 unit = page width). */
  postMatrix: THREE.Matrix4
  /** Latest unfiltered pose from the tracker; smoothed into group.matrix every render frame. */
  rawPose: THREE.Matrix4
  filter: PoseFilter | null
  scene?: TargetScene
  building?: Promise<void>
  visible: boolean
  foundAt: number
  lostAt: number
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

  constructor(
    scene: THREE.Scene,
    assets: AssetManager,
    onEvent: <K extends keyof TargetEvents>(e: K, p: TargetEvents[K]) => void,
    { debug = false, smoothing = true, poseFilter = {} as Partial<PoseFilterOptions> } = {},
  ) {
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
        filter: this.smoothing ? new PoseFilter(this.poseFilter) : null,
        visible: false,
        foundAt: 0,
        lostAt: -Infinity,
      })
    }
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
        a.filter.sample(now, a.group.matrix)
      } else a.group.matrix.copy(a.rawPose)
      if (!a.visible) {
        a.visible = true
        a.group.visible = true
        if (now - a.lostAt > REINTRO_AFTER_S) a.foundAt = now
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
        a.lostAt = now
        a.scene?.hide()
        console.info(`[ar] target lost: ${a.config.id}`)
        this.onEvent('lost', { config: a.config })
      }
    }
    a.group.matrixWorldNeedsUpdate = true
  }

  /** Lazy content build on first detection. */
  private ensureScene(a: Anchor) {
    if (a.scene || a.building) return
    const scene = new TargetScene(a.config)
    a.building = scene.build(this.assets).then((failed) => {
      a.scene = scene
      a.group.add(scene.root)
      if (a.visible) scene.show()
      if (failed.length) this.onEvent('contentError', { config: a.config, ids: failed })
    })
  }

  tick(now: number, dt: number) {
    for (const a of this.anchors.values()) {
      if (!a.visible) continue
      // Interpolating at render rate smooths the steps between ~15–30 Hz tracker updates.
      if (a.filter) {
        a.filter.sample(now, a.group.matrix)
        a.group.matrixWorldNeedsUpdate = true
      }
      a.scene?.update({ t: now - a.foundAt, dt, time: now })
    }
  }

  /** Raycast a tap against visible targets' content; falls back to the page plane for the burst. */
  tap(raycaster: THREE.Raycaster) {
    for (const a of this.anchors.values()) {
      if (!a.visible || !a.scene) continue
      a.group.updateMatrixWorld(true)
      const hit = raycaster.intersectObjects(a.scene.tappables, true)[0] ?? null
      let pagePoint: THREE.Vector3 | null = null
      if (!hit) {
        const normal = new THREE.Vector3(0, 0, 1).transformDirection(a.group.matrixWorld)
        const origin = new THREE.Vector3().setFromMatrixPosition(a.group.matrixWorld)
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin)
        const p = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
        if (p) pagePoint = a.scene.root.worldToLocal(p)
      }
      a.scene.tap(hit, pagePoint)
    }
  }

  /** Dev/test hook: raw vs displayed pose of each visible target. */
  debugPoses() {
    return [...this.anchors.values()]
      .filter((a) => a.visible)
      .map((a) => ({ id: a.config.id, raw: a.rawPose.toArray(), shown: a.group.matrix.toArray() }))
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
