import { useCallback, useEffect, useRef, useState } from 'react'
import { ARManager, type ARCard, type ARErrorCode, type ARStatus } from '../ar/ARManager'
import type { ExperienceConfig } from '../ar/types'
import { ARControls } from './ARControls'
import { ErrorScreen } from './ErrorScreen'
import { LoadingScreen } from './LoadingScreen'
import { PhotoSheet } from './PhotoSheet'
import { ReadCard } from './ReadCard'
import { FilmControls } from './FilmControls'
import { FilmPlayer } from './FilmPlayer'
import type { FilmHandle } from '../ar/content/ContentNode'
import { ScanOverlay } from './ScanOverlay'
import { Leaf } from './Leaf'
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
  const [card, setCard] = useState<ARCard | null>(null)
  const [zoom, setZoom] = useState(1)
  const [film, setFilm] = useState<FilmHandle | null>(null)
  const [watching, setWatching] = useState<FilmHandle | null>(null)

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
      ar.on('card', setCard),
      ar.on('zoom', setZoom),
      ar.on('film', setFilm),
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
    <div className="fixed inset-0 overflow-hidden bg-ink select-none">
      {/* touch-none: pinches zoom the AR view, not the web page */}
      <div ref={containerRef} key={attempt} className="absolute inset-0 touch-none" />

      {status === 'loading' && !error && !cameraReady && <LoadingScreen step={step} />}
      {status === 'loading' && !error && cameraReady && <ScanOverlay lost={false} preparing={step} />}
      {status === 'scanning' && <ScanOverlay lost={everFound} />}
      {toast && status === 'tracking' && (
        <div className="pop-in pointer-events-none absolute top-[max(1.25rem,env(safe-area-inset-top))] left-1/2 z-20 flex -translate-x-1/2 -rotate-2 items-center gap-2 rounded-full bg-paper py-1.5 pr-4 pl-2.5 font-display text-lg text-forest shadow-[0_6px_16px_-6px_rgb(0_0_0/0.45)]">
          <Leaf still className="h-6 w-6" />
          {toast}
        </div>
      )}

      {zoom > 1 && (
        <button
          onClick={() => managerRef.current?.resetZoom()}
          aria-label="Reset zoom"
          className="absolute top-[max(1.4rem,env(safe-area-inset-top))] right-4 z-20 flex items-center gap-1.5 rounded-full bg-ink/55 py-1.5 pr-2.5 pl-3 text-sm font-semibold text-paper tabular-nums backdrop-blur"
        >
          {zoom.toFixed(1)}×
          <svg viewBox="0 0 20 20" className="h-3 w-3" aria-hidden="true">
            <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {showHud && <TrackingHud manager={getManager} />}
      <ARControls onClose={onExit} onCapture={ready ? capture : undefined} />
      {film && !watching && ready && <FilmControls film={film} onWatch={() => setWatching(film)} />}
      {card && <ReadCard card={card} onClose={() => setCard(null)} />}
      {watching && <FilmPlayer film={watching} onClose={() => setWatching(null)} />}
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
