import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Controller } from 'mind-ar/dist/mindar-image.prod.js'
import { AssetManager } from './AssetManager'
import { unlockMedia } from './mediaUnlock'
import { Emitter } from './Emitter'
import type { PoseFilterOptions } from './PoseFilter'
import { preloadEngine, preloadTargets } from './preload'
import { TargetManager } from './TargetManager'
import type { ExperienceConfig, TargetConfig } from './types'
import type { CardSpec, FilmHandle } from './content/ContentNode'

export type ARStatus = 'idle' | 'loading' | 'scanning' | 'tracking' | 'error'

/** A tap-to-read card, with the tap position (viewport px) it flies out of. */
export type ARCard = CardSpec & { from: { x: number; y: number } }

export type ARErrorCode =
  | 'insecure'
  | 'no-camera-api'
  | 'no-webgl'
  | 'camera-denied'
  | 'no-camera'
  | 'camera-busy'
  | 'target-load'
  | 'engine-load'
  | 'unknown'

export class ARError extends Error {
  readonly code: ARErrorCode
  constructor(code: ARErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

interface AREvents extends Record<string, unknown> {
  status: ARStatus
  /** Camera feed is visible; remaining loading can be shown as a light overlay. */
  cameraReady: true
  loadingStep: string
  found: TargetConfig
  lost: TargetConfig
  contentError: string[]
  error: ARError
  /** Content asked to show a card (tap-to-read); `from` is the tap, in viewport px, for the fly-in. */
  card: ARCard
  /** Current pinch zoom (1 = none). */
  zoom: number
  /** A film is in view (or null). */
  film: FilmHandle | null
}

export interface AROptions {
  /** Show the page outline, axes and a test cube on every target. */
  debug?: boolean
  /** Our decomposed pose filter (default). false = MindAR's per-element filter, for A/B testing. */
  smoothing?: boolean
  /** Override PoseFilter tuning. */
  poseFilter?: Partial<PoseFilterOptions>
  /** Requested camera height in pixels (720 default; 1080 gives the tracker more detail). */
  cameraHeight?: number
}

/**
 * Owns the camera, the MindAR controller and the Three.js renderer. React only listens to events.
 * Uses MindAR's core Controller directly (not MindARThree) so it works with current three.js.
 */
export class ARManager extends Emitter<AREvents> {
  private container: HTMLElement
  private config: ExperienceConfig
  private video?: HTMLVideoElement
  private controller?: Controller
  private renderer?: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera()
  private assets = new AssetManager()
  private targets: TargetManager
  private clock = new THREE.Clock()
  private raycaster = new THREE.Raycaster()
  private stopped = false
  private pendingCapture?: (blob: Blob | null) => void
  private smoothing: boolean
  private cameraHeight: number
  /** Pinch zoom: factor and the top-left of the visible window, in unzoomed container px. */
  private zoomState = { z: 1, x: 0, y: 0 }
  private pointers = new Map<number, { x: number; y: number }>()
  private gesture: { dist: number; z: number; mid: { x: number; y: number }; anchor: { x: number; y: number } } | null = null
  private panFrom: { x: number; y: number; zx: number; zy: number } | null = null
  /** The current touch sequence zoomed or panned, so lifting the finger isn't a tap. */
  private gestured = false
  private sampleCtx?: CanvasRenderingContext2D
  private videoBox = { left: 0, top: 0, width: 1, height: 1 }
  private lastTap = { x: 0, y: 0 }
  status: ARStatus = 'idle'

  constructor(container: HTMLElement, config: ExperienceConfig, opts: AROptions = {}) {
    super()
    this.container = container
    this.config = config
    this.targets = new TargetManager(
      this.scene,
      this.assets,
      (event, payload) => {
        if (event === 'found') this.emit('found', payload.config)
        if (event === 'lost') this.emit('lost', payload.config)
        if (event === 'contentError' && 'ids' in payload) this.emit('contentError', payload.ids)
        this.setStatus(this.targets.anyVisible ? 'tracking' : 'scanning')
      },
      {
        camera: this.camera,
        environment: () => this.environment(),
        sampleCamera: (p) => this.sampleCamera(p),
        sampleCameraEach: (p) => this.cameraColours(p),
        openCard: (c) => this.emit('card', { ...c, from: this.lastTap }),
        setFilm: (f) => this.emit('film', f),
      },
      { debug: opts.debug, smoothing: opts.smoothing ?? true, poseFilter: opts.poseFilter },
    )
    this.smoothing = opts.smoothing ?? true
    this.cameraHeight = opts.cameraHeight ?? 720
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8fb3d9, 2.4))
    const sun = new THREE.DirectionalLight(0xffffff, 1.6)
    sun.position.set(-0.5, 1, 1.5)
    this.scene.add(sun)
  }

  async start() {
    try {
      this.setStatus('loading')
      this.preflight()
      // Kick off downloads now so they overlap the camera permission prompt (usually already
      // cached from the landing page's idle preload).
      const engineP = preloadEngine().catch(() => {
        throw new ARError('engine-load')
      })
      const targetsP = preloadTargets(this.config.mindFile).catch(() => {
        throw new ARError('target-load')
      })
      engineP.catch(() => undefined)
      targetsP.catch(() => undefined)
      this.step('Starting camera…')
      await this.startVideo()
      if (this.stopped) return
      this.emit('cameraReady', true)
      this.step('Loading AR engine…')
      const { Controller } = await engineP
      if (this.stopped) return
      this.startRenderer()
      const video = this.video!
      this.controller = new Controller({
        inputWidth: video.videoWidth,
        inputHeight: video.videoHeight,
        maxTrack: 1,
        // With our PoseFilter on, MindAR's own filter is bypassed (a very high cutoff ≈ passthrough).
        filterMinCF: this.smoothing ? 1e9 : 0.0005,
        filterBeta: this.smoothing ? 0 : 0.001,
        warmupTolerance: 3,
        missTolerance: 5,
        onUpdate: (data) => {
          if (data.type === 'updateMatrix' && data.targetIndex !== undefined) {
            this.targets.update(data.targetIndex, data.worldMatrix ?? null, this.clock.elapsedTime)
          }
        },
      })
      this.step('Loading magazine pages…')
      const { dimensions } = this.controller.addImageTargetsFromBuffer(await targetsP)
      this.targets.register(this.config.targets, dimensions)
      this.resize()
      this.step('Warming up…')
      // dummyRun compiles the tracker's GPU shaders synchronously (the slowest step on phones);
      // give the browser two frames to paint the camera and this label first.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      if (this.stopped) return
      await this.controller.dummyRun(video)
      if (this.stopped) return
      this.controller.processVideo(video)
      this.step('')
      this.setStatus('scanning')
      this.targets.prebuildWhenIdle()
    } catch (e) {
      const err = toARError(e)
      console.error('[ar]', err, e)
      this.setStatus('error')
      this.emit('error', err)
    }
  }

  stop() {
    this.stopped = true
    this.controller?.stopProcessVideo()
    this.controller?.dispose?.()
    const stream = this.video?.srcObject as MediaStream | null
    stream?.getTracks().forEach((t) => t.stop())
    this.video?.remove()
    this.renderer?.setAnimationLoop(null)
    this.targets.dispose()
    this.assets.dispose()
    this.renderer?.dispose()
    this.renderer?.domElement.remove()
    window.removeEventListener('resize', this.onResize)
    this.container.removeEventListener('pointerdown', this.onPointerDown)
    this.container.removeEventListener('pointermove', this.onPointerMove)
    this.container.removeEventListener('pointerup', this.onPointerUp)
    this.container.removeEventListener('pointercancel', this.onPointerUp)
    this.container.removeEventListener('wheel', this.onWheel)
  }

  /** Dev/test hook used by the stability benchmark. */
  debugState() {
    return {
      poses: this.targets.debugPoses(),
      projection: this.camera.projectionMatrix.toArray(),
      size: [this.container.clientWidth, this.container.clientHeight],
      video: [this.video?.videoWidth ?? 0, this.video?.videoHeight ?? 0],
      time: this.clock.elapsedTime,
    }
  }

  /** Composite camera frame + AR layer into a JPEG (the "photo" button). */
  capture(): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.pendingCapture = resolve
    })
  }

  private preflight() {
    if (!window.isSecureContext) throw new ARError('insecure')
    if (!navigator.mediaDevices?.getUserMedia) throw new ARError('no-camera-api')
    const probe = document.createElement('canvas')
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new ARError('no-webgl')
  }

  private async startVideo() {
    const video = document.createElement('video')
    video.setAttribute('autoplay', '')
    video.setAttribute('muted', '')
    video.setAttribute('playsinline', '')
    video.muted = true
    video.className = 'ar-video'
    this.container.appendChild(video)
    this.video = video
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'environment',
          width: { ideal: Math.round((this.cameraHeight * 16) / 9) },
          height: { ideal: this.cameraHeight },
        },
      })
    } catch (e) {
      const name = (e as DOMException)?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') throw new ARError('camera-denied')
      if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new ARError('no-camera')
      if (name === 'NotReadableError' || name === 'AbortError') throw new ARError('camera-busy')
      throw new ARError('unknown', String(e))
    }
    if (this.stopped) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    video.srcObject = stream
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1) resolve()
      else video.addEventListener('loadedmetadata', () => resolve(), { once: true })
    })
    await video.play().catch(() => undefined)
    video.width = video.videoWidth
    video.height = video.videoHeight
  }

  private startRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.className = 'ar-canvas'
    this.container.appendChild(renderer.domElement)
    this.renderer = renderer
    window.addEventListener('resize', this.onResize)
    this.container.addEventListener('pointerdown', this.onPointerDown)
    this.container.addEventListener('pointermove', this.onPointerMove)
    this.container.addEventListener('pointerup', this.onPointerUp)
    this.container.addEventListener('pointercancel', this.onPointerUp)
    this.container.addEventListener('wheel', this.onWheel, { passive: false })
    this.clock.start()
    renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.1)
      this.targets.tick(this.clock.elapsedTime, dt)
      renderer.render(this.scene, this.camera)
      if (this.pendingCapture) this.flushCapture()
    })
  }

  private flushCapture() {
    const resolve = this.pendingCapture!
    this.pendingCapture = undefined
    const video = this.video!
    const gl = this.renderer!.domElement
    const out = document.createElement('canvas')
    out.width = gl.width
    out.height = gl.height
    const ctx = out.getContext('2d')!
    // Same "cover" crop and zoom as the on-screen video.
    const { z, x, y } = this.zoomState
    const px = out.width / this.container.clientWidth
    const scale = Math.max(out.width / video.videoWidth, out.height / video.videoHeight)
    const w = video.videoWidth * scale
    const h = video.videoHeight * scale
    ctx.setTransform(z, 0, 0, z, -x * z * px, -y * z * px)
    ctx.drawImage(video, (out.width - w) / 2, (out.height - h) / 2, w, h)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(gl, 0, 0)
    out.toBlob(resolve, 'image/jpeg', 0.92)
  }

  private onResize = () => this.resize()

  private onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return
    if (this.pointers.size === 0) this.gestured = false
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.targets.dragging) return // one finger at a time while carrying something
    if (this.pointers.size === 1 && this.targets.dragStart(this.rayAt(e.clientX, e.clientY))) {
      this.gestured = true // a drag, never a tap
      return
    }
    if (this.pointers.size === 2) this.beginPinch()
    else if (this.pointers.size === 1) {
      const { x, y } = this.zoomState
      this.panFrom = { x: e.clientX, y: e.clientY, zx: x, zy: y }
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.targets.dragging) {
      this.targets.dragMove(this.rayAt(e.clientX, e.clientY))
      return
    }
    if (this.gesture && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = this.local({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
      const z = this.gesture.z * (dist / this.gesture.dist)
      // Keep the page point that was under the fingers under them.
      this.setZoom(z, this.gesture.anchor.x - mid.x / z, this.gesture.anchor.y - mid.y / z)
      this.gestured = true
    } else if (this.panFrom && this.zoomState.z > 1) {
      const dx = e.clientX - this.panFrom.x
      const dy = e.clientY - this.panFrom.y
      if (!this.gestured && Math.hypot(dx, dy) < 8) return
      this.gestured = true
      const { z } = this.zoomState
      this.setZoom(z, this.panFrom.zx - dx / z, this.panFrom.zy - dy / z)
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return
    if (this.targets.dragging) {
      if (this.pointers.size === 0) this.targets.dragEnd(e.type === 'pointerup' ? this.rayAt(e.clientX, e.clientY) : null)
      return
    }
    if (this.pointers.size === 1) {
      // One finger left after a pinch: carry on as a pan from here.
      const [p] = [...this.pointers.values()]
      const { x, y } = this.zoomState
      this.panFrom = { x: p.x, y: p.y, zx: x, zy: y }
      this.gesture = null
    }
    if (this.pointers.size > 0) return
    this.gesture = null
    this.panFrom = null
    if (!this.gestured && e.type === 'pointerup') this.tapAt(e.clientX, e.clientY)
  }

  /** Trackpad pinch (ctrl + wheel) on desktop, for testing. */
  private onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    const p = this.local({ x: e.clientX, y: e.clientY })
    const { z, x, y } = this.zoomState
    const nz = z * Math.exp(-e.deltaY * 0.01)
    const ax = x + p.x / z
    const ay = y + p.y / z
    this.setZoom(nz, ax - p.x / nz, ay - p.y / nz)
  }

  private beginPinch() {
    const [a, b] = [...this.pointers.values()]
    const mid = this.local({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
    const { z, x, y } = this.zoomState
    this.gesture = { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), z, mid, anchor: { x: x + mid.x / z, y: y + mid.y / z } }
    this.panFrom = null
  }

  private local(p: { x: number; y: number }) {
    const r = this.container.getBoundingClientRect()
    return { x: p.x - r.left, y: p.y - r.top }
  }

  resetZoom() {
    this.setZoom(1, 0, 0)
  }

  /** Zoom by narrowing the 3D camera's view window (stays sharp) and scaling the camera feed to match. */
  private setZoom(z: number, x: number, y: number) {
    const cw = this.container.clientWidth
    const ch = this.container.clientHeight
    z = Math.min(4, Math.max(1, z))
    if (z < 1.02) z = 1
    x = Math.min(cw - cw / z, Math.max(0, x))
    y = Math.min(ch - ch / z, Math.max(0, y))
    const changed = z !== this.zoomState.z
    this.zoomState = { z, x, y }
    if (z === 1) this.camera.clearViewOffset()
    else this.camera.setViewOffset(cw, ch, x, y, cw / z, ch / z)
    if (this.video) {
      const { left, top } = this.videoBox
      this.video.style.transformOrigin = `${-left}px ${-top}px`
      this.video.style.transform = z === 1 ? '' : `translate(${-x * z}px, ${-y * z}px) scale(${z})`
    }
    if (changed) this.emit('zoom', z)
  }

  private tapAt(clientX: number, clientY: number) {
    unlockMedia() // a tap is a chance to top the sound-unlocked video pool back up
    this.lastTap = { x: clientX, y: clientY }
    this.targets.tap(this.rayAt(clientX, clientY))
  }

  /** The camera ray through a screen point (zoom included). */
  private rayAt(clientX: number, clientY: number) {
    const rect = this.container.getBoundingClientRect()
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    return this.raycaster
  }

  private envMap?: THREE.Texture
  private environment(): THREE.Texture {
    if (!this.envMap) {
      const pmrem = new THREE.PMREMGenerator(this.renderer!)
      this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      pmrem.dispose()
    }
    return this.envMap
  }

  /** Median camera colour under world-space points (each projected through the current, zoomed view). */
  private sampleCamera(points: THREE.Vector3[]): THREE.Color | null {
    const seen = this.cameraColours(points)?.filter((c) => c !== null)
    if (!seen || seen.length < 3) return null
    const med = (i: number) => seen.map((c) => c[i]).sort((m, n) => m - n)[seen.length >> 1] / 255
    return new THREE.Color().setRGB(med(0), med(1), med(2), THREE.SRGBColorSpace)
  }

  /** The camera colour (sRGB 0–255) under each world-space point, or null where it's off screen. */
  private cameraColours(points: THREE.Vector3[]): ([number, number, number] | null)[] | null {
    const video = this.video
    if (!video || video.readyState < 2 || !video.videoWidth) return null
    const W = 160
    const H = Math.round((W * video.videoHeight) / video.videoWidth)
    if (!this.sampleCtx) {
      const c = document.createElement('canvas')
      this.sampleCtx = c.getContext('2d', { willReadFrequently: true })!
    }
    const ctx = this.sampleCtx
    if (ctx.canvas.width !== W || ctx.canvas.height !== H) Object.assign(ctx.canvas, { width: W, height: H })
    ctx.drawImage(video, 0, 0, W, H)
    const px = ctx.getImageData(0, 0, W, H).data
    const cw = this.container.clientWidth
    const ch = this.container.clientHeight
    const { z, x, y } = this.zoomState
    const { left, top, width, height } = this.videoBox
    const v = new THREE.Vector3()
    return points.map((p) => {
      v.copy(p).project(this.camera)
      if (v.z > 1) return null
      // zoomed NDC → unzoomed container px → video px
      const cx = x + ((v.x + 1) / 2) * (cw / z)
      const cy = y + ((1 - v.y) / 2) * (ch / z)
      const u = Math.floor(((cx - left) / width) * W)
      const w = Math.floor(((cy - top) / height) * H)
      if (u < 0 || w < 0 || u >= W || w >= H) return null
      const i = (w * W + u) * 4
      return [px[i], px[i + 1], px[i + 2]]
    })
  }

  /** Fit video ("cover") and derive the camera frustum from MindAR's projection (ported from MindARThree). */
  private resize() {
    const { container, video, controller, renderer, camera } = this
    if (!video || !controller || !renderer) return
    const cw = container.clientWidth
    const ch = container.clientHeight
    const videoRatio = video.videoWidth / video.videoHeight
    const containerRatio = cw / ch
    let vw: number, vh: number
    if (videoRatio > containerRatio) {
      vh = ch
      vw = vh * videoRatio
    } else {
      vw = cw
      vh = vw / videoRatio
    }

    const proj = controller.getProjectionMatrix()
    const inputRatio = controller.inputWidth / controller.inputHeight
    const inputAdjust = inputRatio > containerRatio ? video.width / controller.inputWidth : video.height / controller.inputHeight
    const videoDisplayHeight =
      (inputRatio > containerRatio ? ch : (cw / controller.inputWidth) * controller.inputHeight) * inputAdjust
    const fovAdjust = ch / videoDisplayHeight

    camera.fov = (2 * Math.atan((1 / proj[5]) * fovAdjust) * 180) / Math.PI
    camera.near = proj[14] / (proj[10] - 1.0)
    camera.far = proj[14] / (proj[10] + 1.0)
    camera.aspect = cw / ch
    camera.updateProjectionMatrix()

    this.videoBox = { left: -(vw - cw) / 2, top: -(vh - ch) / 2, width: vw, height: vh }
    Object.assign(video.style, {
      top: `${this.videoBox.top}px`,
      left: `${this.videoBox.left}px`,
      width: `${vw}px`,
      height: `${vh}px`,
    })
    renderer.setSize(cw, ch)
    const { z, x, y } = this.zoomState
    this.setZoom(z, x, y)
  }

  private setStatus(s: ARStatus) {
    if (this.status === s || this.status === 'error') return
    this.status = s
    this.emit('status', s)
  }

  private stepAt = performance.now()
  private stepLabel = 'init'

  /** Report a loading step to the UI, and log how long the previous step took. */
  private step(label: string) {
    const now = performance.now()
    console.info(`[ar] timing ${this.stepLabel} ${Math.round(now - this.stepAt)}ms`)
    this.stepAt = now
    this.stepLabel = label || 'done'
    if (label) this.emit('loadingStep', label)
  }
}

function toARError(e: unknown): ARError {
  if (e instanceof ARError) return e
  return new ARError('unknown', e instanceof Error ? e.message : String(e))
}
