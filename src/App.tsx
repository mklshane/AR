import { lazy, Suspense, useEffect, useState } from 'react'
import { Landing } from './components/Landing'
import { LoadingScreen } from './components/LoadingScreen'
import { preloadWhenIdle } from './ar/preload'
import { experience } from './data/targets'

// Three.js + MindAR stay out of the landing bundle; they're prefetched in idle time instead.
const loadCameraUI = () => import('./components/CameraUI')
const CameraUI = lazy(() => loadCameraUI().then((m) => ({ default: m.CameraUI })))

const params = new URLSearchParams(location.search)
const debug = params.has('debug')
/** ?rawpose: MindAR's original filter instead of PoseFilter (for comparing stability). */
const smoothing = !params.has('rawpose')

export default function App() {
  const [inAR, setInAR] = useState(params.has('ar'))
  useEffect(() => {
    // While the visitor reads the landing page, fetch the AR view, engine and targets.
    preloadWhenIdle(experience.mindFile)
    const id = setTimeout(() => void loadCameraUI().catch(() => undefined), 800)
    return () => clearTimeout(id)
  }, [])
  if (!inAR) return <Landing onStart={() => setInAR(true)} />
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-kape"><LoadingScreen step="Opening the camera…" /></div>}>
      <CameraUI config={experience} debug={debug} smoothing={smoothing} onExit={() => setInAR(false)} />
    </Suspense>
  )
}
