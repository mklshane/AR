/**
 * Warm the heavy, user-independent downloads (MindAR engine, compiled targets) before they're needed:
 * on the landing page while the user reads, and in parallel with the camera permission prompt.
 * Results are cached in memory, so ARManager never fetches them twice.
 */
let engine: Promise<typeof import('mind-ar/dist/mindar-image.prod.js')> | undefined
const targetFiles = new Map<string, Promise<ArrayBuffer>>()

export function preloadEngine() {
  engine ??= import('mind-ar/dist/mindar-image.prod.js').catch((e) => {
    engine = undefined // allow a retry
    throw e
  })
  return engine
}

export function preloadTargets(url: string) {
  let p = targetFiles.get(url)
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
      return r.arrayBuffer()
    })
    p.catch(() => targetFiles.delete(url))
    targetFiles.set(url, p)
  }
  return p
}

/** Start both downloads when the browser is idle, unless the user asked to save data. */
export function preloadWhenIdle(mindFile: string) {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData) return
  const go = () => {
    preloadEngine().catch(() => undefined)
    preloadTargets(mindFile).catch(() => undefined)
  }
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 })
  else setTimeout(go, 1500)
}
