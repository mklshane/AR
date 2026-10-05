/**
 * iOS Safari only lets a video play *with sound* if that element was first played during a user gesture.
 * So on the "Open camera" tap we start a couple of video elements on a silent clip, and films that appear
 * later (once a page is found, long after the tap) borrow one of these instead of creating their own.
 * Same idea as Howler.js's unlocked HTML5 audio pool.
 */

/** 0.05 s of silence (8 kHz mono WAV). */
const SILENCE =
  'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA'

const POOL_SIZE = 2
const pool: HTMLVideoElement[] = []

function create(): HTMLVideoElement {
  const v = document.createElement('video')
  v.playsInline = true
  v.setAttribute('playsinline', '')
  v.setAttribute('webkit-playsinline', '')
  return v
}

/** Call synchronously inside a tap/click handler. Safe to call more than once. */
export function unlockMedia() {
  while (pool.length < POOL_SIZE) {
    const v = create()
    v.src = SILENCE
    void v.play().then(() => v.pause(), () => undefined)
    pool.push(v)
  }
}

/** A video element for a film: unlocked for sound if one was prepared, otherwise a plain (muted) one. */
export function takeVideo(): { video: HTMLVideoElement; unlocked: boolean } {
  const v = pool.shift()
  return v ? { video: v, unlocked: true } : { video: create(), unlocked: false }
}
