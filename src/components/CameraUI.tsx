import { useCallback, useEffect, useRef, useState } from 'react'
import { ARManager, type ARErrorCode, type ARStatus } from '../ar/ARManager'
import type { ExperienceConfig } from '../ar/types'
import { ARControls } from './ARControls'
import { ErrorScreen } from './ErrorScreen'
import { LoadingScreen } from './LoadingScreen'
import { PhotoSheet } from './PhotoSheet'
import { ScanOverlay } from './ScanOverlay'

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
  const [toast, setToast] = useState<string | null>(null)
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // Dev tuning: ?pf=minCutoff,beta,rotMinCutoff,rotBeta
    const pf = import.meta.env.DEV ? new URLSearchParams(location.search).get('pf')?.split(',').map(Number) : undefined
    const poseFilter = pf ? { minCutoff: pf[0], beta: pf[1], rotMinCutoff: pf[2], rotBeta: pf[3] } : undefined
    const ar = new ARManager(containerRef.current!, config, { debug, smoothing, poseFilter })
    managerRef.current = ar
    if (import.meta.env.DEV) (window as unknown as { __ar?: ARManager }).__ar = ar
    const offs = [
      ar.on('status', setStatus),
      ar.on('loadingStep', setStep),
      ar.on('error', (e) => setError(e.code)),
      ar.on('found', (t) => {
        setEverFound(true)
        setToast(`${t.title.length > 28 ? 'Poster' : t.title} found ✓`)
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

  const capture = useCallback(async () => {
    const blob = await managerRef.current?.capture()
    if (blob) setPhoto({ blob, url: URL.createObjectURL(blob) })
  }, [])

  const retry = () => {
    setError(null)
    setStatus('loading')
    setEverFound(false)
    setAttempt((n) => n + 1)
  }

  const ready = status === 'scanning' || status === 'tracking'

  return (
    <div className="fixed inset-0 overflow-hidden bg-black select-none">
      <div ref={containerRef} key={attempt} className="absolute inset-0" />

      {status === 'loading' && !error && <LoadingScreen step={step} />}
      {status === 'scanning' && <ScanOverlay lost={everFound} />}
      {toast && status === 'tracking' && (
        <div className="pop-in pointer-events-none absolute top-[max(1.25rem,env(safe-area-inset-top))] left-1/2 z-20 -translate-x-1/2 rounded-full bg-cream px-4 py-2 text-sm font-bold text-navy shadow-lg">
          {toast}
        </div>
      )}

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
