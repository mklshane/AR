/**
 * Dev-only camera stand-in for testing on a desktop without pointing a webcam at a print.
 *
 *   ?fakecam            stream the poster moving around a fake desk (tests found + anchoring)
 *   ?fakecam=still      same, without motion
 *   ?fakecam=denied     simulate the user refusing camera permission
 *   ?fakecam=nocamera   simulate a device with no camera
 *
 * At runtime `window.__fakecam.hidden = true` takes the poster out of frame (tests "lost").
 */
export interface FakeCamState {
  hidden: boolean
  still: boolean
}

declare global {
  interface Window {
    __fakecam?: FakeCamState
  }
}

export function installFakeCamera(mode: string, imageSrc: string) {
  const md = navigator.mediaDevices
  if (!md) return
  const state: FakeCamState = { hidden: false, still: mode === 'still' }
  window.__fakecam = state

  md.getUserMedia = async () => {
    if (mode === 'denied') throw new DOMException('Permission denied', 'NotAllowedError')
    if (mode === 'nocamera') throw new DOMException('Requested device not found', 'NotFoundError')

    const img = new Image()
    img.src = imageSrc
    await img.decode()
    const canvas = document.createElement('canvas')
    // Portrait, like a phone's rear camera stream.
    canvas.width = 720
    canvas.height = 1280
    const ctx = canvas.getContext('2d')!
    const t0 = performance.now()

    const draw = () => {
      const t = state.still ? 0 : (performance.now() - t0) / 1000
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
      g.addColorStop(0, '#6b5a4a')
      g.addColorStop(1, '#3d3229')
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      if (!state.hidden) {
        const h = canvas.height * 0.62 * (1 + 0.12 * Math.sin(t * 0.5))
        const w = (h * img.width) / img.height
        ctx.translate(canvas.width / 2 + Math.sin(t * 0.7) * 90, canvas.height / 2 + Math.sin(t * 0.9) * 30)
        ctx.rotate(Math.sin(t * 0.6) * 0.25)
        ctx.transform(1, 0, Math.sin(t * 0.4) * 0.12, 1, 0, 0) // fake perspective skew
        ctx.shadowColor = 'rgba(0,0,0,0.5)'
        ctx.shadowBlur = 30
        ctx.drawImage(img, -w / 2, -h / 2, w, h)
        ctx.shadowBlur = 0
      }
      requestAnimationFrame(draw)
    }
    draw()
    return canvas.captureStream(30)
  }
}
