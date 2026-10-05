import { lazy, Suspense, useEffect, useState } from 'react'
import { Landing } from './components/Landing'
import { LoadingScreen } from './components/LoadingScreen'
import { preloadWhenIdle } from './ar/preload'
import { unlockMedia } from './ar/mediaUnlock'
import { unlockSfx } from './ar/sfx'
import { experience } from './data/targets'

// Three.js + MindAR stay out of the landing bundle; they're prefetched in idle time instead.
const loadCameraUI = () => import('./components/CameraUI')
const CameraUI = lazy(() => loadCameraUI().then((m) => ({ default: m.CameraUI })))
const loadMagazine = () => import('./components/Magazine')
const Magazine = lazy(() => loadMagazine().then((m) => ({ default: m.Magazine })))

const params = new URLSearchParams(location.search)
const debug = params.has('debug')
/** ?rawpose: MindAR's original filter instead of PoseFilter (for comparing stability). */
const smoothing = !params.has('rawpose')

type View = 'landing' | 'ar' | 'magazine'

export default function App() {
  const [view, setView] = useState<View>(params.has('ar') ? 'ar' : params.has('magazine') ? 'magazine' : 'landing')
  useEffect(() => {
    // While the visitor reads the landing page, fetch the AR view, engine and targets.
    preloadWhenIdle(experience.mindFile)
    const id = setTimeout(() => {
      void loadCameraUI().catch(() => undefined)
      void loadMagazine().catch(() => undefined)
    }, 800)
    return () => clearTimeout(id)
  }, [])
  const toLanding = () => setView('landing')
  const openCamera = () => {
    // Runs inside the "Open camera" tap: the only moment iOS lets us unlock video sound (and the
    // paper doll's sound effects) for later.
    unlockMedia()
    unlockSfx()
    setView('ar')
  }
  if (view === 'landing') return <Landing onStart={openCamera} onRead={() => setView('magazine')} />
  if (view === 'magazine') {
    return (
      <Suspense fallback={<div className="fixed inset-0 bg-forest" />}>
        <Magazine onExit={toLanding} />
      </Suspense>
    )
  }
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-forest"><LoadingScreen step="Opening the camera…" /></div>}>
      <CameraUI config={experience} debug={debug} smoothing={smoothing} onExit={toLanding} />
    </Suspense>
  )
}
