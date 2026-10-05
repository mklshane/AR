import * as THREE from 'three'
import type { AlphaVideoContent } from '../types'
import { type BuildContext, type ContentNode, disposeObject } from './ContentNode'

/**
 * A transparent clip on the page, made by scripts/alpha-clip.py (colour over alpha in one H.264 video).
 * Plays when the page is found, holds its last frame unless it loops, and replays on a fresh scan.
 */
export async function buildAlphaVideo(c: AlphaVideoContent, { page }: BuildContext): Promise<ContentNode> {
  const video = document.createElement('video')
  Object.assign(video, { muted: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous', loop: !!c.loop })
  video.setAttribute('playsinline', '')
  video.setAttribute('muted', '')
  video.src = c.src
  await new Promise<void>((resolve, reject) => {
    if (video.readyState >= 1) return resolve()
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error(`Could not load video ${c.src}`))
    video.load()
  })

  const colorTex = new THREE.VideoTexture(video)
  colorTex.colorSpace = THREE.SRGBColorSpace
  colorTex.repeat.set(1, 0.5)
  colorTex.offset.set(0, 0.5)
  const alphaTex = new THREE.VideoTexture(video)
  alphaTex.repeat.set(1, 0.5)

  const w = page.len(c.width)
  const h = (w * video.videoHeight) / 2 / video.videoWidth
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: colorTex, alphaMap: alphaTex, transparent: true, depthWrite: false }),
  )
  const [x, y] = page.point(c.at)
  mesh.position.set(x, y, c.lift ?? 0.002)
  mesh.visible = false

  let shown = false
  let lastT = Infinity
  const play = () => void video.play().catch(() => undefined)

  return {
    object: mesh,
    update({ t }) {
      // The scan clock drops back when the page is re-found after a while: play it again from the start.
      if (t < lastT - 0.25) {
        video.currentTime = 0
        if (shown) play()
      }
      lastT = t
      // Hidden until a frame has decoded, so nothing flashes while it loads.
      mesh.visible = video.readyState >= 2 && (video.currentTime > 0 || video.ended)
    },
    onShow() {
      shown = true
      if (!video.ended) play()
    },
    onHide() {
      shown = false
      video.pause()
    },
    dispose() {
      disposeObject(mesh)
      colorTex.dispose()
      alphaTex.dispose()
      video.removeAttribute('src')
      video.load()
    },
  }
}
