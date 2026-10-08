/**
 * Dev-only camera stand-in for testing on a desktop without pointing a webcam at a print.
 *
 *   ?fakecam            stream the poster moving around a fake desk (tests found + anchoring)
 *   ?fakecam=still      same, without motion
 *   ?fakecam=noisy      poster held still but small in frame, with sensor noise + hand shake
 *   ?fakecam=rough      moving, small, noisy and slightly blurred: a phone pointed at a laptop
 *   ?fakecam=jolt       small and noisy, held still, but jumps to a new spot every 2.5s (sudden camera jolts)
 *   ?fakecam=denied     simulate the user refusing camera permission
 *   ?fakecam=nocamera   simulate a device with no camera
 *
 * At runtime `window.__fakecam.hidden = true` takes the poster out of frame (tests "lost").
 */
export interface FakeCamState {
  hidden: boolean
  still: boolean
  /** Where the poster was drawn in the last frame (canvas px), for accuracy benchmarks. */
  truth?: { cx: number; cy: number; rot: number; skew: number; w: number; h: number; frameW: number; frameH: number; jump: number }
}

declare global {
  interface Window {
    __fakecam?: FakeCamState
  }
}

export function installFakeCamera(mode: string, imageSrc: string) {
  const md = navigator.mediaDevices
  if (!md) return
  const rough = mode === 'rough'
  const jolt = mode === 'jolt'
  const noisy = mode === 'noisy' || rough || jolt
  const state: FakeCamState = { hidden: false, still: mode === 'still' || mode === 'noisy' || jolt }
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
    // Pre-baked noise tiles, picked at random each frame, approximate a phone sensor's grain.
    const noiseTiles = noisy ? Array.from({ length: 6 }, () => makeNoise(canvas.width, canvas.height, jolt ? 60 : 40)) : []

    const draw = () => {
      const t = state.still ? 0 : (performance.now() - t0) / 1000
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
      g.addColorStop(0, '#6b5a4a')
      g.addColorStop(1, '#3d3229')
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      if (!state.hidden) {
        // Fits the frame's width too, for wide pictures (e.g. the whole wraparound cover).
        const fill = Math.min(jolt ? 0.25 : noisy ? 0.3 : 0.62, (0.85 * canvas.width * img.height) / (img.width * canvas.height))
        const h = canvas.height * fill * (1 + 0.12 * Math.sin(t * 0.5))
        const w = (h * img.width) / img.height
        const shake = noisy ? () => (Math.random() - 0.5) * 2 : () => 0
        // Jolt: a deterministic new pose every 2.5s (seeded by the jump index).
        const j = jolt ? Math.floor((performance.now() - t0) / 2500) : 0
        const jx = jolt ? Math.sin(j * 12.9898) * 110 : 0
        const jy = jolt ? Math.sin(j * 78.233) * 160 : 0
        const jr = jolt ? Math.sin(j * 37.719) * 0.35 : 0
        const cx = canvas.width / 2 + Math.sin(t * 0.7) * 90 + shake() + jx
        const cy = canvas.height / 2 + Math.sin(t * 0.9) * 30 + shake() + jy
        const rot = (noisy ? 0.15 : 0) + Math.sin(t * 0.6) * 0.25 + jr
        const skew = Math.sin(t * 0.4) * 0.12
        state.truth = { cx, cy, rot, skew, w, h, frameW: canvas.width, frameH: canvas.height, jump: j }
        ctx.translate(cx, cy)
        ctx.rotate(rot)
        ctx.transform(1, 0, skew, 1, 0, 0) // fake perspective skew
        if (rough || jolt) ctx.filter = 'blur(1.2px)'
        ctx.shadowColor = 'rgba(0,0,0,0.5)'
        ctx.shadowBlur = 30
        ctx.drawImage(img, -w / 2, -h / 2, w, h)
        ctx.shadowBlur = 0
        ctx.filter = 'none'
      }
      if (noisy) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.drawImage(noiseTiles[(Math.random() * noiseTiles.length) | 0], 0, 0)
      }
      requestAnimationFrame(draw)
    }
    draw()
    return canvas.captureStream(30)
  }
}

function makeNoise(w: number, h: number, strength: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const data = ctx.createImageData(w, h)
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.random() * 255
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v
    data.data[i + 3] = strength
  }
  ctx.putImageData(data, 0, 0)
  return c
}
