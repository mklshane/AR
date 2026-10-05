import { useEffect, useState } from 'react'
import type { FilmHandle } from '../ar/content/ContentNode'

interface Props {
  film: FilmHandle
  onWatch: () => void
}

/** Sound and full-screen buttons either side of the shutter while a film is in view. */
export function FilmControls({ film, onWatch }: Props) {
  const muted = useMuted(film.video)
  const button =
    'absolute bottom-[max(2.25rem,calc(env(safe-area-inset-bottom)+0.5rem))] z-20 flex h-12 w-12 items-center justify-center rounded-full bg-ink/55 text-paper backdrop-blur transition active:scale-90'

  return (
    <>
      <button
        onClick={() => film.toggleSound()}
        aria-label={muted ? 'Turn sound on' : 'Mute'}
        className={`${button} left-[calc(50%-6.5rem)] ${muted ? 'ring-2 ring-gold' : ''}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
          {muted ? (
            <path d="M16 9.5l5 5M21 9.5l-5 5" />
          ) : (
            <>
              <path d="M15.5 9a4.5 4.5 0 0 1 0 6" />
              <path d="M18 6.5a8 8 0 0 1 0 11" />
            </>
          )}
        </svg>
      </button>
      <button onClick={onWatch} aria-label={`Watch ${film.title} full screen`} className={`${button} right-[calc(50%-6.5rem)]`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      </button>
    </>
  )
}

function useMuted(video: HTMLVideoElement) {
  const [muted, setMuted] = useState(video.muted)
  useEffect(() => {
    const sync = () => setMuted(video.muted)
    sync()
    video.addEventListener('volumechange', sync)
    return () => video.removeEventListener('volumechange', sync)
  }, [video])
  return muted
}
