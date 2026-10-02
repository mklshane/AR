import { useCallback, useEffect, useRef, useState } from 'react'
import { ARManager, type ARErrorCode, type ARStatus } from '../ar/ARManager'
import type { ExperienceConfig } from '../ar/types'
import { ARControls } from './ARControls'
import { ErrorScreen } from './ErrorScreen'
import { LoadingScreen } from './LoadingScreen'
import { PhotoSheet } from './PhotoSheet'
import { ScanOverlay } from './ScanOverlay'
import { Sun } from './Sun'
import { TrackingHud } from './TrackingHud'

// Field-testing switches (work on deployed builds): ?hud, ?res=1080, ?pf=…
const search = new URLSearchParams(location.search)
const showHud = search.has('hud')
const cameraHeight = Number(search.get('res')) || undefined

interface Props {
  config: ExperienceConfig
  debug: boolean
  smoothing: boolean
  onExit: () => void
}

export function CameraUI({ config, debug, smoothing, onExit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const managerRef = useRef<ARManager | null>(null)
  const [status, setStatus] = useState<ARStatus>('loading')
  const [step, setStep] = useState('')
  const [error, setError] = useState<ARErrorCode | null>(null)
  const [everFound, setEverFound] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // Tuning: ?pf=minCutoff,maxCutoff,beta,noiseSigma,motionSigma (works on deployed builds, for phone tests)
    const pf = search.get('pf')?.split(',').map(Number)
    const poseFilter =
      pf?.length === 5 ? { minCutoff: pf[0], maxCutoff: pf[1], beta: pf[2], noiseSigma: pf[3], motionSigma: pf[4] } : undefined
    const ar = new ARManager(containerRef.current!, config, { debug, smoothing, poseFilter, cameraHeight })
    managerRef.current = ar
    if (import.meta.env.DEV) (window as unknown as { __ar?: ARManager }).__ar = ar
    const offs = [
      ar.on('status', setStatus),
      ar.on('loadingStep', setStep),
      ar.on('cameraReady', () => setCameraReady(true)),
      ar.on('error', (e) => setError(e.code)),
      ar.on('found', () => {
        setEverFound(true)
        setToast('Nakita!')
      }),
      ar.on('contentError', (ids) => console.warn('[ar] some content failed to load:', ids)),
    ]
    ar.start()
    return () => {
      offs.forEach((off) => off())
      ar.stop()
      managerRef.current = null
    }
  }, [config, debug, smoothing, attempt])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(id)
  }, [toast])

  const getManager = useCallback(() => managerRef.current, [])

  const capture = useCallback(async () => {
    const blob = await managerRef.current?.capture()
    if (blob) setPhoto({ blob, url: URL.createObjectURL(blob) })
  }, [])

  const retry = () => {
    setError(null)
    setStatus('loading')
    setEverFound(false)
    setCameraReady(false)
    setAttempt((n) => n + 1)
  }

  const ready = status === 'scanning' || status === 'tracking'

  return (
    <div className="fixed inset-0 overflow-hidden bg-kape select-none">
      <div ref={containerRef} key={attempt} className="absolute inset-0" />

      {status === 'loading' && !error && !cameraReady && <LoadingScreen step={step} />}
      {status === 'loading' && !error && cameraReady && <ScanOverlay lost={false} preparing={step} />}
      {status === 'scanning' && <ScanOverlay lost={everFound} />}
      {toast && status === 'tracking' && (
        <div className="pop-in pointer-events-none absolute top-[max(1.25rem,env(safe-area-inset-top))] left-1/2 z-20 flex -translate-x-1/2 -rotate-2 items-center gap-2 rounded-md bg-paper py-1.5 pr-4 pl-2 font-display text-lg text-kape shadow-[0_3px_0_rgb(58_36_24/0.35)]">
          <Sun still className="h-7 w-7" />
          {toast}
        </div>
      )}

      {showHud && <TrackingHud manager={getManager} />}
      <ARControls onClose={onExit} onCapture={ready ? capture : undefined} />
      {error && <ErrorScreen code={error} onRetry={retry} onBack={onExit} />}
      {photo && (
        <PhotoSheet
          blob={photo.blob}
          url={photo.url}
          onClose={() => {
            URL.revokeObjectURL(photo.url)
            setPhoto(null)
          }}
        />
      )}
    </div>
  )
}
