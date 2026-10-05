/**
 * Tiny synthesised UI sounds (no audio files): a paper rustle, a snap and a swish, plus a short buzz on
 * phones that support it (Android; iOS Safari has no vibration API).
 *
 * iOS: Web Audio only starts from a tap (a finger *lift*, not a press), so call unlockSfx() in the
 * "Open camera" tap. And it is muted by the silent switch unless the page's audio session is
 * 'playback' (Safari 17+), the same category video sound uses.
 */

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (!ctx) {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'playback'
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** A burst of filtered noise with a quick attack and exponential decay. */
function hiss(a: AudioContext, at: number, dur: number, freq: number, q: number, gain: number, sweepTo?: number) {
  const src = a.createBufferSource()
  src.buffer = noise
  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(freq, at)
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + dur)
  filter.Q.value = q
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.012, dur / 4))
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(filter).connect(g).connect(a.destination)
  src.start(at, Math.random() * 0.3, dur + 0.05)
}

/** A short pitched blip, gliding from `from` to `to` Hz. */
function blip(a: AudioContext, at: number, dur: number, from: number, to: number, gain: number, type: OscillatorType = 'sine') {
  const osc = a.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + dur)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(g).connect(a.destination)
  osc.start(at)
  osc.stop(at + dur + 0.02)
}

/** Call inside a tap: makes and starts the AudioContext with one silent sample, so later sounds play. */
export function unlockSfx() {
  const a = audio()
  if (!a) return
  const src = a.createBufferSource()
  src.buffer = a.createBuffer(1, 1, a.sampleRate)
  src.connect(a.destination)
  src.start()
}

const buzz = (ms: number | number[]) => navigator.vibrate?.(ms)

/** Picking a paper piece up: a soft rustle. */
export function pickUp() {
  const a = audio()
  buzz(8)
  if (!a) return
  const t = a.currentTime
  hiss(a, t, 0.09, 3200, 0.9, 0.12)
  hiss(a, t + 0.05, 0.07, 2400, 0.9, 0.07)
}

/** A piece snapping onto the doll: a crisp click with a little rising pop under it. */
export function snap() {
  const a = audio()
  buzz([14, 30, 10])
  if (!a) return
  const t = a.currentTime
  hiss(a, t, 0.025, 5200, 2, 0.35) // the click
  blip(a, t + 0.004, 0.09, 420, 880, 0.22) // the pop
  blip(a, t + 0.06, 0.16, 1320, 1250, 0.06, 'triangle') // a faint sparkle tail
}

/** A piece leaving the doll (dragged off or swapped out): a quick downward swish. */
export function swish() {
  const a = audio()
  buzz(6)
  if (!a) return
  hiss(a, a.currentTime, 0.2, 2600, 1.2, 0.1, 700)
}
