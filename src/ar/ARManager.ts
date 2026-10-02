import * as THREE from 'three'
import type { Controller } from 'mind-ar/dist/mindar-image.prod.js'
import { AssetManager } from './AssetManager'
import { Emitter } from './Emitter'
import type { PoseFilterOptions } from './PoseFilter'
import { preloadEngine, preloadTargets } from './preload'
import { TargetManager } from './TargetManager'
import type { ExperienceConfig, TargetConfig } from './types'

export type ARStatus = 'idle' | 'loading' | 'scanning' | 'tracking' | 'error'

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
    this.container.removeEventListener('pointerup', this.onTap)
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
    this.container.addEventListener('pointerup', this.onTap)
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
    // Same "cover" crop as the on-screen video.
    const scale = Math.max(out.width / video.videoWidth, out.height / video.videoHeight)
    const w = video.videoWidth * scale
    const h = video.videoHeight * scale
    ctx.drawImage(video, (out.width - w) / 2, (out.height - h) / 2, w, h)
    ctx.drawImage(gl, 0, 0)
    out.toBlob(resolve, 'image/jpeg', 0.92)
  }

  private onResize = () => this.resize()

  private onTap = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return
    const rect = this.container.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    this.targets.tap(this.raycaster)
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

    Object.assign(video.style, {
      top: `${-(vh - ch) / 2}px`,
      left: `${-(vw - cw) / 2}px`,
      width: `${vw}px`,
      height: `${vh}px`,
    })
    renderer.setSize(cw, ch)
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
