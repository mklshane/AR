import { lazy, Suspense, useState } from 'react'
import { Landing } from './components/Landing'
import { LoadingScreen } from './components/LoadingScreen'
import { experience } from './data/targets'

// Three.js + MindAR only download once the user taps START AR.
const CameraUI = lazy(() => import('./components/CameraUI').then((m) => ({ default: m.CameraUI })))

const params = new URLSearchParams(location.search)
const debug = params.has('debug')

export default function App() {
  const [inAR, setInAR] = useState(params.has('ar'))
  if (!inAR) return <Landing posterSrc={experience.targets[0].image} onStart={() => setInAR(true)} />
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black"><LoadingScreen step="Loading AR…" /></div>}>
      <CameraUI config={experience} debug={debug} onExit={() => setInAR(false)} />
    </Suspense>
  )
}
