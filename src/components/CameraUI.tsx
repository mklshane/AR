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
  onExit: () => void
}

export function CameraUI({ config, debug, onExit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const managerRef = useRef<ARManager | null>(null)
  const [status, setStatus] = useState<ARStatus>('loading')
  const [step, setStep] = useState('')
  const [error, setError] = useState<ARErrorCode | null>(null)
  const [everFound, setEverFound] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const ar = new ARManager(containerRef.current!, config, { debug })
    managerRef.current = ar
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
  }, [config, debug, attempt])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(id)
  }, [toast])

  const capture = useCallback(async () => {
    const blob = await managerRef.current?.capture()
    if (blob) setPhoto(blob)
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
      {status === 'tracking' && (
        <p className="pointer-events-none absolute inset-x-0 bottom-[calc(max(1.75rem,env(safe-area-inset-bottom))+88px)] z-10 text-center text-xs text-cream/80 [text-shadow:0_1px_4px_rgb(0_0_0/0.7)]">
          Tap the stickers ✦
        </p>
      )}

      <ARControls onClose={onExit} onCapture={ready ? capture : undefined} />
      {error && <ErrorScreen code={error} onRetry={retry} onBack={onExit} />}
      {photo && <PhotoSheet blob={photo} onClose={() => setPhoto(null)} />}
    </div>
  )
}
